from .pongBaseConsumer import BaseGameConsumer
from ..pongLobby import LobbyManager
from ..pongEngine import GameEngine
from ..pongHelper import now_str
import json
import asyncio
import jwt
from django.conf import settings
from channels.db import database_sync_to_async
from users.models import GameInvitation

class MatchConsumer(BaseGameConsumer):
    """
    ╔═══════════════════════════════════════════════════╗
    ║               MatchConsumer                       ║
    ╠═══════════════════════════════════════════════════╣
    ║ WebSocket consumer for Pong match communication   ║
    ║                                                   ║
    ║ • Handles matchmaking and game invitations        ║
    ║ • Processes player input and game state           ║
    ║ • Manages game loop and physics                   ║
    ║ • Updates ELO ratings after matches               ║
    ╚═══════════════════════════════════════════════════╝
    """

    # Create lobby and game instances.
    lobby_manager = LobbyManager()
    game_engine = GameEngine()


    #===========================================================#
    #                AUTHENTICATION MANAGEMENT                  #
    #===========================================================#

    @database_sync_to_async
    def get_user_from_token(self, token):
        """
        Validate JWT token and return the corresponding user.
        """

        try:
            from users.models import customUser
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )
            
            user_id = payload.get('user_id')
            if not user_id:
                return None
            return customUser.objects.filter(id=user_id).first()
            
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except Exception:
            return None

    @database_sync_to_async
    def get_user_by_username(self, username):
        """
        Look up a user by username.
        """

        from users.models import customUser
        try:
            return customUser.objects.get(username=username)
        except customUser.DoesNotExist:
            print(f"User not found: {username}")
            return None

    #===========================================================#
    #                WEBSOCKET MANAGEMENT                       #
    #===========================================================#

    async def connect(self):
        """
        Handle WebSocket connection with token in query string.
        """

        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return
            
        await self.accept()

    async def disconnect(self, close_code):
        """
        Handle player disconnection from match or queue.
        """

        if hasattr(self, 'user') and self.user.is_authenticated:
            await self.cancel_user_invitations()
        if hasattr(self, 'user'):
            await self.lobby_manager.remove_player(self)

    #===========================================================#
    #                INVITATION MANAGEMENT                      #
    #===========================================================#

    async def handle_invitation_cancel(self, data):
        """
        Handle cancellation of an invitation
        """

        if not self.user.is_authenticated:
            return
        await self.cancel_user_invitations()
        await self.send(text_data=json.dumps({
            'type': 'invitation_cancelled',
            'message': 'Your invitation has been cancelled'
        }))

    @database_sync_to_async
    def cancel_user_invitations(self):
        """
        Cancel all pending invitations sent by the user
        """

        from users.models import GameInvitation
        return GameInvitation.objects.filter(
            sender=self.user, 
            status='pending'
        ).update(status='cancelled')

    async def handle_invite_friend(self, data):
        """
        Handle invitation to a friend to join a match
        """

        friend_username = data.get('friend_username')
        if not friend_username:
            await self.send(text_data=json.dumps({
                'type': 'friend_invite_error',
                'message': 'Aucun nom d\'utilisateur fourni'
            }))
            return

        success, message = await self.create_game_invitation(friend_username)
        if success:
            await self.send(text_data=json.dumps({
                'type': 'friend_invite_sent',
                'friend_username': friend_username,
                'message': message
            }))
        else:
            await self.send(text_data=json.dumps({
                'type': 'friend_invite_error',
                'message': message
            }))

    @database_sync_to_async
    def create_game_invitation(self, friend_username):
        """
        Create a game invitation in the database
        """

        try:
            from users.models import customUser
            
            # Get user's friend
            try:
                friend = customUser.objects.get(username=friend_username)
            except customUser.DoesNotExist:
                return False, "Ami non trouvé"
            
            # Auto-invitation not allowed
            if self.user.username == friend_username:
                return False, "Vous ne pouvez pas vous inviter vous-même"
                
            # Check for pending invitation
            existing_invitation = GameInvitation.objects.filter(
                sender=self.user,
                recipient=friend,
                status='pending',
                match_type='regular'
            ).exists()
            
            if existing_invitation:
                return False, "Vous avez déjà une invitation en attente pour cet ami"
                
            # Create invitation
            invitation = GameInvitation(
                sender=self.user,
                recipient=friend,
                match_type='regular'
            )
            invitation.save()
            
            return True, "Invitation envoyée avec succès"
            
        except Exception as e:
            print(f"Error creating invitation: {str(e)}")
            return False, "Une erreur s'est produite lors de la création de l'invitation"

    async def join_invited_game(self, data):
        """
        Join a game created from an invitation.
        """

        game_id = data.get('game_id')
        opponent_username = data.get('opponent_username')

        if not game_id or not opponent_username:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Information de jeu manquante'
            }))
            return

        # Disable matchmaking
        if hasattr(self, 'match_task') and self.match_task:
            self.match_task.cancel()

        # Look for opponent
        opponent_user = await self.get_user_by_username(opponent_username)
        if not opponent_user:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Adversaire introuvable'
            }))
            return

        # Player order
        is_game_creator = data.get('is_game_creator', False)

        # Common setup for both players
        self.match_id = game_id
        self.player_number = 1 if is_game_creator else 2

        # Initialize game if it doesn't exist
        if game_id not in self.lobby_manager.invited_games:
            self.lobby_manager.invited_games[game_id] = {
                'created_at': now_str()
            }

        # Register player as creator
        if is_game_creator:
            self.lobby_manager.invited_games[game_id]['creator'] = self
            print(f"Game {game_id}: {self.user.username} registered as creator")

            # Check if recipient is waiting
            if 'recipient' in self.lobby_manager.invited_games[game_id]:
                recipient = self.lobby_manager.invited_games[game_id]['recipient']
                print(f"Game {game_id}: Found waiting recipient {recipient.user.username}, creating match")

                # Create match
                await self.lobby_manager.create_match_from_invitation(self, recipient, game_id)
                return

            # If recipient isn't waiting, print waiting message
            await self.send(text_data=json.dumps({
                'type': 'waiting_for_opponent',
                'message': f'En attente de {opponent_username}...',
                'game_id': game_id
            }))

        # Register player as recipient
        else:
            self.lobby_manager.invited_games[game_id]['recipient'] = self
            print(f"Game {game_id}: {self.user.username} registered as recipient")

            # Check if creator is waiting
            if 'creator' in self.lobby_manager.invited_games[game_id]:
                creator = self.lobby_manager.invited_games[game_id]['creator']
                print(f"Game {game_id}: Found waiting creator {creator.user.username}, creating match")

                # Create match
                await self.lobby_manager.create_match_from_invitation(creator, self, game_id)
                return

            # If creator isn't waiting, print waiting message
            await self.send(text_data=json.dumps({
                'type': 'waiting_for_creator',
                'message': f'En attente de {opponent_username} pour créer la partie...',
                'game_id': game_id
            }))

    #===========================================================#
    #                MESSAGE MANAGEMENT                         #
    #===========================================================#

    async def receive(self, text_data):
        """
        Process incoming WebSocket messages.
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type', '')

            # Backward compatibility
            if 'input' in data and not message_type:
                input_value = data.get('input', 0)
                await self.process_player_input(input_value)
                return
                
            # Handle specific message types
            if message_type == "find_match":
                await self.find_match()
            elif message_type == "cancel_matchmaking":
                await self.lobby_manager.remove_player(self)
                await self.send(text_data=json.dumps({
                    "type": "matchmaking_cancelled",
                    "message": "Recherche de match annulée"
                }))
            elif message_type == "player_input":
                input_value = data.get('input', 0)
                await self.process_player_input(input_value)
            elif message_type == "invite_friend":
                await self.handle_invite_friend(data)
            elif message_type == "cancel_invitation":
                await self.handle_invitation_cancel(data)
            elif message_type == "join_invited_game":
                await self.join_invited_game(data)
            elif message_type == "declare_forfeit":
                await self.lobby_manager.remove_player(self)
                
        except json.JSONDecodeError:
            pass  # Invalid JSON format
        except Exception as e:
            print(f"Error in MatchConsumer.receive: {str(e)}")
            import traceback
            traceback.print_exc()

    async def handle_message(self, data, message_type):
        """
        Handle match-specific messages.
        """

        if not hasattr(self, 'user'):
            await self.send_error("You must authenticate first")
            return
            
        if message_type == "find_match":
            await self.find_match()
            
        elif message_type == "cancel_matchmaking":
            await self.lobby_manager.remove_player(self)
            await self.send_message("matchmaking_cancelled", {
                "message": "Recherche de match annulée"
            })
            
        elif message_type == "player_input":
            if not hasattr(self, 'match_id'):
                return
                
            input_value = data.get('input', 0)
            await self.process_player_input(input_value)

    #===========================================================#
    #                MATCHMAKING MANAGEMENT                     #
    #===========================================================#

    async def find_match(self):
        """
        Find a match for the player.
        """

        # Set up player data for matchmaking
        self.match_id = None
        self.player_number = None
        
        # Add to matchmaking queue
        await self.lobby_manager.add_player_to_queue(self)
        
        # Set up periodic matchmaking check
        self.match_task = asyncio.create_task(self.periodic_matchmaking())
            
    async def periodic_matchmaking(self):
        """
        Periodically try to find matches for all waiting players.
        """

        try:
            # Try to find matches
            while not hasattr(self, 'match_id') or not self.match_id:
                await self.lobby_manager.find_matches_for_all()
                
                # Update queue position
                if not hasattr(self, 'match_id') or not self.match_id:
                    position = 0
                    for i, (player, _, _) in enumerate(self.lobby_manager.waiting_players):
                        if player == self:
                            position = i + 1
                            break
                            
                    if position > 0:
                        await self.send_message("matchmaking_update", {
                            "queue_position": position,
                            "message": f"Position dans la file: {position}"
                        })
                
                # Wait for next attempt
                await asyncio.sleep(2)
                
        # End of task
        except asyncio.CancelledError:
            pass

    #===========================================================#
    #                PONG MANAGEMENT                            #
    #===========================================================#

    async def process_player_input(self, input_value):
        """
        Update paddle position based on player input.
        """

        # Verify input
        if input_value not in [-1, 0, 1]:
            return
            
        # Find match to update
        match_data = self.lobby_manager.active_matches.get(self.match_id)
        if not match_data:
            return
            
        # Update game state with input
        player_key = f"player{self.player_number}"
        match_data["game_state"]["inputs"][player_key] = input_value


    async def run_game_loop(self, match_id):
        """
        Run the game loop for a match.
        """

        match_data = self.lobby_manager.active_matches.get(match_id)
        if not match_data:
            print(f"Error: Match {match_id} not found in active_matches")
            return

        game_state = match_data["game_state"]
        players = match_data["players"]

        print(f"Starting game loop for match {match_id} with players: {[p.user.username for p in players]}")

        try:
            while True:
                # Game speed control
                await asyncio.sleep(0.02)  # 50 FPS

                # Check players connection status
                if not all(hasattr(player, 'match_id') and player.match_id == match_id for player in players):
                    # Find remaining player to declare a winner
                    remaining_player = next((p for p in players if hasattr(p, 'match_id') and p.match_id == match_id), None)
                    if remaining_player:
                        print(f"Declaring {remaining_player.user.username} as winner due to opponent disconnect")
                        await self.handle_match_result(match_id, remaining_player.user.username)
                    return

                # Update game state
                self.game_engine.update_game_state(game_state)

                # Check for goals
                game_over, winner_username = await self.game_engine.check_goals(game_state)

                if game_over:
                    print(f"Game over! Winner: {winner_username}")
                    await self.handle_match_result(match_id, winner_username)
                    return

                # Send updated state to players
                for player in players:
                    try:
                        await player.send(text_data=json.dumps({
                            "type": "game_state",
                            "game_state": game_state
                        }))
                    except Exception as e:
                        print(f"Error sending game state to {player.user.username}: {e}")
                    
        except Exception as e:
            print(f"Error in game loop for match {match_id}: {e}")
            import traceback
            traceback.print_exc()

    async def handle_match_result(self, match_id, winner_username):
        """
        Handle the end of a match.
        """

        match_data = self.lobby_manager.active_matches.get(match_id)
        if not match_data:
            return

        players = match_data["players"]

        # Find winner and loser
        winner = next((player for player in players if player.user.username == winner_username), None)
        if not winner:
            return

        loser = next((player for player in players if player != winner), None)

        # Update ELO
        if winner and loser:
            await self.update_elo_ratings(winner.user, loser.user)

        # Display game result
        for player in players:
            try:
                # Get display name
                winner_display = winner.user.nickname if hasattr(winner.user, 'nickname') and winner.user.nickname else winner.user.username

                await player.send(text_data=json.dumps({
                    "type": "game_over",
                    "winner": winner_username,
                    "message": f"{winner_display} a gagné la partie!"
                }))
            except Exception as e:
                print(f"Error sending game result notification: {str(e)}")

        # Cleanup
        if match_id in self.lobby_manager.active_matches:
            del self.lobby_manager.active_matches[match_id]
        for player in players:
            if hasattr(player, 'match_id'):
                player.match_id = None
            if hasattr(player, 'player_number'):
                player.player_number = None

    @database_sync_to_async
    def update_elo_ratings(self, winner, loser, K=32):
        """
        Updates ELO ratings after a match.
        """
        from ..pongHelper import calculate_elo_change

        # Calculate ELO ratings
        winner_elo, loser_elo = calculate_elo_change(winner.elo, loser.elo, K)

        # Update user elo
        winner.elo = winner_elo
        loser.elo = loser_elo
        winner.wins += 1
        loser.losses += 1

        # Record match in history
        timestamp = now_str()
        winner.history.append({
            'opponent_id': loser.id,
            'opponent_username': loser.username,
            'result': 'win',
            'timestamp': timestamp,
            'match_type': 'regular'
        })
        loser.history.append({
            'opponent_id': winner.id,
            'opponent_username': winner.username,
            'result': 'loss',
            'timestamp': timestamp,
            'match_type': 'regular'
        })
        winner.save()
        loser.save()