from .pongBaseConsumer import BaseGameConsumer
from ..pongTournament import TournamentManager
from channels.db import database_sync_to_async
import json
import asyncio

class TournamentConsumer(BaseGameConsumer):
    """
    ╔═══════════════════════════════════════════════════╗
    ║            TournamentConsumer                     ║
    ╠═══════════════════════════════════════════════════╣
    ║ WebSocket consumer for Pong tournament system     ║
    ║                                                   ║
    ║ • Manages tournament brackets and progression     ║
    ║ • Handles player joining and matchmaking          ║
    ║ • Processes match results and rankings            ║
    ║ • Broadcasts tournament states to participants    ║
    ╚═══════════════════════════════════════════════════╝
    """
    
    # Create tournament instance.
    tournament_manager = TournamentManager()

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
        Handle player disconnection from tournament.
        """
        if hasattr(self, 'user') and self.user.is_authenticated:
            # Check if player is in a tournament
            if hasattr(self, 'tournament_id') and self.tournament_id is not None:
                # Get tournament info to check if already cancelled
                tournament = self.tournament_manager.tournaments.get(self.tournament_id)
                
                # Only process disconnect if tournament exists and isn't already cancelled or completed
                if tournament and not tournament.get("complete", False):
                    # Even if tournament is cancelled, we still want to process the disconnect
                    # to properly clean up player state, but with a different message
                    if tournament.get("cancelled", False):
                        print(f"Processing disconnect for {self.user.username} from already cancelled tournament {self.tournament_id}")
                    else:
                        print(f"Processing tournament disconnect for {self.user.username}")
                    
                    await self.tournament_manager.handle_player_disconnect(self)
                else:
                    print(f"Skipping tournament disconnect for {self.user.username} - tournament not found or completed")

    #===========================================================#
    #                MESSAGE MANAGEMENT                         #
    #===========================================================#

    async def receive(self, text_data):
        """
        Process incoming WebSocket messages.
        """
        
        print(f"Tournament received: {text_data}")
        try:
            data = json.loads(text_data)
            message_type = data.get('type', '')
            print(f"Tournament message type: {message_type}")

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
    
    async def handle_match_result(self, match_id, tournament_id, winner_username, forfeit=False):
        """
        Handle the result of a match.
        """

        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
    
        # Get winner and looser
        winner = next((player for player in players if player.user.username == winner_username), None)
        if not winner:
            return
    
        loser = next((player for player in players 
                    if hasattr(player, 'match_id') and player.match_id == match_id 
                    and player.user.username != winner_username), None)
    
        # Get display names
        winner_display = get_display_name(winner.user)
    
        # Store result
        if match_id.startswith("semifinal"):
            tournament["semifinal_winners"][match_id] = winner
            if loser:
                tournament["semifinal_losers"][match_id] = loser
        elif match_id == "final":
            # Tournament winner
            print(f"Final match complete - winner: {winner_username}")
            await self.handle_tournament_winner(tournament_id, winner_username)
        elif match_id == "third_place":
            # Third place winner
            print(f"Third place match complete - winner: {winner_username}")
            await self.handle_third_place_winner(tournament_id, winner_username)
    
        # Notify result
        result_message = {
            "type": "match_result",
            "match_id": match_id,
            "winner": winner_username,
            "winner_display": winner_display,
            "message": f"{winner_display} a remporté le match!" if not forfeit else f"{winner_display} gagne par forfait!"
        }
        for player in players:
            if player in [winner, loser] or not hasattr(player, 'match_id') or not player.match_id:
                try:
                    await player.send(text_data=json.dumps(result_message))
                except Exception:
                    pass
                
        # Clear IDs
        for player in [winner, loser]:
            if player:
                player.match_id = None
                player.player_number = None
    
        # Check tournament progress
        await self.check_tournament_progress(tournament_id)
        
        # End of the tournament, broadcast result
        if tournament.get("complete", False):
            await self.broadcast_tournament_rankings(tournament_id)

    #===========================================================#
    #                TOURNAMENT MANAGEMENT                      #
    #===========================================================#

    async def join_tournament(self):
        """
        Join an existing tournament or create a new one.
        """

        print(f"Adding {self.user.username} to tournament")
        try:
            # Add player to tournament
            tournament_id, player_position = await self.tournament_manager.add_player_to_tournament(self)

            # Get tournament state
            state = await self.tournament_manager.get_tournament_state(tournament_id)
            state["your_position"] = player_position

            # Send state to player
            print(f"Sending tournament state to {self.user.username}")
            await self.send(text_data=json.dumps(state))

            # Broadcast state to all players
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