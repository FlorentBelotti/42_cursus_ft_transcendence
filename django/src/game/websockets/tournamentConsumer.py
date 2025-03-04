from .baseConsumer import BaseGameConsumer
from ..pongTournament import TournamentManager
from channels.db import database_sync_to_async
import json
import asyncio

class TournamentConsumer(BaseGameConsumer):
    """
    Consumer for handling Pong tournaments.
    """
    # Shared tournament manager across all instances
    tournament_manager = TournamentManager()

    async def connect(self):
        """
        Handle WebSocket connection with token in query string.
        """
        # Get user from scope - Django Channels has already authenticated the user
        self.user = self.scope["user"]
        print(f"Tournament connection attempt by: {getattr(self.user, 'username', 'unauthenticated')}")

        if not self.user.is_authenticated:
            # Close connection if not authenticated
            print(f"Tournament connection rejected: User not authenticated")
            await self.close()
            return

        # Accept the connection since user is authenticated
        print(f"Tournament connection accepted: {self.user.username}")
        await self.accept()

    async def receive(self, text_data):
        """
        Process incoming WebSocket messages.
        """
        print(f"Tournament received: {text_data}")
        try:
            data = json.loads(text_data)
            message_type = data.get('type', '')
            print(f"Tournament message type: {message_type}")

            # Handle specific message types directly
            if message_type == "create_tournament":
                print(f"Processing tournament join request from {self.user.username}")
                await self.join_tournament()
            elif message_type == "leave_tournament":
                if hasattr(self, 'tournament_id') and not hasattr(self, 'match_id'):
                    await self.tournament_manager.handle_player_disconnect(self)
                    await self.send(text_data=json.dumps({
                        "type": "tournament_left",
                        "message": "Vous avez quitté le tournoi"
                    }))
            elif message_type == "player_input":
                input_value = data.get('input', 0)
                await self.tournament_manager.handle_player_input(self, input_value)
            else:
                print(f"Unknown message type: {message_type}")

        except json.JSONDecodeError:
            print("Invalid JSON format")
        except Exception as e:
            print(f"Error in TournamentConsumer.receive: {str(e)}")
            import traceback
            traceback.print_exc()

    async def disconnect(self, close_code):
        """
        Handle player disconnection from tournament.
        """
        if hasattr(self, 'user'):
            await self.tournament_manager.handle_player_disconnect(self)
    
    async def handle_match_result(self, match_id, tournament_id, winner_username, forfeit=False):
        """
        Handle the result of a match.
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
    
        # Find winner and loser
        winner = next((player for player in players if player.user.username == winner_username), None)
        if not winner:
            return
    
        loser = next((player for player in players 
                    if hasattr(player, 'match_id') and player.match_id == match_id 
                    and player.user.username != winner_username), None)
    
        # Get display names
        winner_display = get_display_name(winner.user)
    
        # Store result in tournament data
        if match_id.startswith("semifinal"):
            tournament["semifinal_winners"][match_id] = winner
            if loser:
                tournament["semifinal_losers"][match_id] = loser
        elif match_id == "final":
            # Handle the tournament winner
            print(f"Final match complete - winner: {winner_username}")
            await self.handle_tournament_winner(tournament_id, winner_username)
        elif match_id == "third_place":
            # Handle third place winner
            print(f"Third place match complete - winner: {winner_username}")
            await self.handle_third_place_winner(tournament_id, winner_username)
    
        # Notify participants and spectators
        result_message = {
            "type": "match_result",
            "match_id": match_id,
            "winner": winner_username,
            "winner_display": winner_display,
            "message": f"{winner_display} a remporté le match!" if not forfeit else f"{winner_display} gagne par forfait!"
        }
    
        # Send to match participants and spectators
        for player in players:
            if player in [winner, loser] or not hasattr(player, 'match_id') or not player.match_id:
                try:
                    await player.send(text_data=json.dumps(result_message))
                except Exception:
                    pass
                
        # Clear match IDs
        for player in [winner, loser]:
            if player:
                player.match_id = None
                player.player_number = None
    
        # Check tournament progress
        await self.check_tournament_progress(tournament_id)
        
        # If tournament is already complete, broadcast rankings again to ensure it's displayed
        if tournament.get("complete", False):
            await self.broadcast_tournament_rankings(tournament_id)

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

    async def join_tournament(self):
        """
        Join an existing tournament or create a new one.
        """
        print(f"Adding {self.user.username} to tournament")
        try:
            # Add player to a tournament
            tournament_id, player_position = await self.tournament_manager.add_player_to_tournament(self)

            # Get tournament state
            state = await self.tournament_manager.get_tournament_state(tournament_id)
            state["your_position"] = player_position

            # Send state to the player
            print(f"Sending tournament state to {self.user.username}")
            await self.send(text_data=json.dumps(state))

            # Broadcast state to all players in the tournament
            await self.broadcast_tournament_state(tournament_id)

            # Check if tournament can start
            tournament = self.tournament_manager.tournaments[tournament_id]
            if tournament.get("ready_to_start", False):
                print(f"Tournament {tournament_id} ready to start!")
                await self.tournament_manager.start_tournament(tournament_id)
        except Exception as e:
            print(f"Error joining tournament: {str(e)}")
            import traceback
            traceback.print_exc()

    async def broadcast_tournament_state(self, tournament_id):
        """
        Broadcast the current tournament state to all participants.
        """
        tournament = self.tournament_manager.tournaments[tournament_id]
        for player in tournament["players"]:
            try:
                state = await self.tournament_manager.get_tournament_state(tournament_id)
                state["your_position"] = player.player_position
                await player.send(text_data=json.dumps(state))
            except Exception as e:
                print(f"Error broadcasting tournament state: {str(e)}")