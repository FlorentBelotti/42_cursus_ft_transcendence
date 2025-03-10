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
    Consumer for handling one-on-one Pong matches.
    """
    # Shared lobby manager across all instances
    lobby_manager = LobbyManager()
    game_engine = GameEngine()

    async def connect(self):
        """
        Handle WebSocket connection with token in query string.
        """
        # Get user from scope - Django Channels has already authenticated the user
        self.user = self.scope["user"]
        
        if not self.user.is_authenticated:
            # Close connection if not authenticated
            await self.close()
            return
            
        # Accept the connection since user is authenticated
        await self.accept()

    @database_sync_to_async
    def get_user_from_token(self, token):
        """
        Validate JWT token and return the corresponding user.
        """
        try:
            from users.models import customUser  # Import here to avoid circular imports
            
            # Decode token
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )
            
            user_id = payload.get('user_id')
            if not user_id:
                return None
            
            # Get user from database
            return customUser.objects.filter(id=user_id).first()
            
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except Exception:
            return None

    async def disconnect(self, close_code):
        """
        Handle player disconnection from match or queue.
        """
        # Remove from waiting queue or handle match forfeit
        if hasattr(self, 'user'):
            await self.lobby_manager.remove_player(self)

    async def receive(self, text_data):
        """
        Process incoming WebSocket messages.
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type', '')
            
            # Backward compatibility - handle simple input messages
            if 'input' in data and not message_type:
                await self.process_player_input(data['input'])
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
                # Handle friend invitation
                await self.handle_invite_friend(data)
        except json.JSONDecodeError:
            pass  # Invalid JSON format
        except Exception as e:
            print(f"Error in MatchConsumer.receive: {str(e)}")

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
        
        # Create the invitation in the database
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
        
        Args:
            friend_username: Username of the friend to invite
            
        Returns:
            tuple: (success, message)
        """
        try:
            from users.models import customUser
            
            # Get friend user object
            try:
                friend = customUser.objects.get(username=friend_username)
            except customUser.DoesNotExist:
                return False, "Ami non trouvé"
            
            # Don't allow inviting yourself
            if self.user.username == friend_username:
                return False, "Vous ne pouvez pas vous inviter vous-même"
                
            # Check if there's already a pending invitation
            existing_invitation = GameInvitation.objects.filter(
                sender=self.user,
                recipient=friend,
                status='pending',
                match_type='regular'
            ).exists()
            
            if existing_invitation:
                return False, "Vous avez déjà une invitation en attente pour cet ami"
                
            # Create the invitation
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

    async def handle_message(self, data, message_type):
        """
        Handle match-specific messages.
        """
        if not hasattr(self, 'user'):
            await self.send_error("You must authenticate first")
            return
            
        if message_type == "find_match":
            # Request to find a match
            await self.find_match()
            
        elif message_type == "cancel_matchmaking":
            # Cancel ongoing matchmaking
            await self.lobby_manager.remove_player(self)
            await self.send_message("matchmaking_cancelled", {
                "message": "Recherche de match annulée"
            })
            
        elif message_type == "player_input":
            # Handle player paddle movement
            if not hasattr(self, 'match_id'):
                return
                
            input_value = data.get('input', 0)
            await self.process_player_input(input_value)
            
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
            while not hasattr(self, 'match_id') or not self.match_id:
                # Try to find matches
                await self.lobby_manager.find_matches_for_all()
                
                # Update queue position for the player
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
                
                # Wait before next attempt
                await asyncio.sleep(2)
                
        except asyncio.CancelledError:
            # Task was cancelled (likely because a match was found)
            pass
                
    async def process_player_input(self, input_value):
        """
        Update paddle position based on player input.
        """
        # Validate input
        if input_value not in [-1, 0, 1]:
            return
            
        # Find match in active matches
        match_data = self.lobby_manager.active_matches.get(self.match_id)
        if not match_data:
            return
            
        # Update game state with input
        player_key = f"player{self.player_number}"
        match_data["game_state"]["inputs"][player_key] = input_value

    # Add to MatchConsumer class
    async def run_game_loop(self, match_id):
        """
        Run the game loop for a match.
        """
        match_data = self.lobby_manager.active_matches.get(match_id)
        if not match_data:
            return

        game_state = match_data["game_state"]
        players = match_data["players"]

        while True:
            # Sleep to control game speed
            await asyncio.sleep(0.02)  # 50 FPS

            # Check if players are still connected
            if not all(hasattr(player, 'match_id') and player.match_id == match_id for player in players):
                # Handle disconnection
                break
            
            # Update game state
            self.game_engine.update_game_state(game_state)

            # Check for goals
            game_over, winner_username = await self.game_engine.check_goals(game_state)

            if game_over:
                # Handle match completion
                await self.handle_match_result(match_id, winner_username)
                break
            
            # Send updated state to players
            for player in players:
                try:
                    await player.send(text_data=json.dumps({
                        "type": "game_update",
                        "game_state": game_state
                    }))
                except Exception:
                    pass

    async def handle_match_result(self, match_id, winner_username):
        """
        Handle the end of a match.

        Args:
            match_id: ID of the completed match
            winner_username: Username of the winner
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

        # Update ELO ratings in the database
        if winner and loser:
            await self.update_elo_ratings(winner.user, loser.user)

        # Notify players of game result
        for player in players:
            try:
                # Get appropriate display names
                winner_display = winner.user.nickname if hasattr(winner.user, 'nickname') and winner.user.nickname else winner.user.username

                await player.send(text_data=json.dumps({
                    "type": "game_over",
                    "winner": winner_username,
                    "message": f"{winner_display} a gagné la partie!"
                }))
            except Exception as e:
                print(f"Error sending game result notification: {str(e)}")

        # Clean up
        if match_id in self.lobby_manager.active_matches:
            del self.lobby_manager.active_matches[match_id]

        # Clear match IDs
        for player in players:
            if hasattr(player, 'match_id'):
                player.match_id = None
            if hasattr(player, 'player_number'):
                player.player_number = None

    @database_sync_to_async
    def update_elo_ratings(self, winner, loser, K=32):
        """
        Updates ELO ratings after a match.

        Args:
            winner: User object of the winner
            loser: User object of the loser
            K: K-factor for ELO calculation (default: 32)
        """
        from ..pongHelper import calculate_elo_change

        # Calculate new ELO ratings
        winner_elo, loser_elo = calculate_elo_change(winner.elo, loser.elo, K)

        # Update user records
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

        # Save changes
        winner.save()
        loser.save()