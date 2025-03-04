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
    
    async def handle_message(self, data, message_type):
        """
        Handle tournament-specific messages.
        """
        if not hasattr(self, 'user'):
            await self.send_error("You must authenticate first")
            return
            
        if message_type == "create_tournament":
            # Request to create or join a tournament (from button click)
            await self.join_tournament()
            
        elif message_type == "leave_tournament":
            # Leave tournament if not in a match
            if hasattr(self, 'tournament_id') and not hasattr(self, 'match_id'):
                await self.tournament_manager.handle_player_disconnect(self)
                await self.send_message("tournament_left", {
                    "message": "Vous avez quitté le tournoi"
                })
                
        elif message_type == "player_input":
            # Handle player paddle movement in tournament match
            input_value = data.get('input', 0)
            await self.tournament_manager.handle_player_input(self, input_value)

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