from .baseConsumer import BaseGameConsumer
from ..pongTournament import TournamentManager
import json
import asyncio

class TournamentConsumer(BaseGameConsumer):
    """
    Consumer for handling Pong tournaments.
    """
    # Shared tournament manager across all instances
    tournament_manager = TournamentManager()
    
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
    
    async def join_tournament(self):
        """
        Join an existing tournament or create a new one.
        """
        # Add player to a tournament
        tournament_id, player_position = await self.tournament_manager.add_player_to_tournament(self)
        
        # Get tournament state
        state = await self.tournament_manager.get_tournament_state(tournament_id)
        state["your_position"] = player_position
        
        # Send state to the player
        await self.send(text_data=json.dumps(state))
        
        # Broadcast state to all players in the tournament
        await self.broadcast_tournament_state(tournament_id)
        
        # Check if tournament can start
        tournament = self.tournament_manager.tournaments[tournament_id]
        if tournament.get("ready_to_start", False):
            await self.tournament_manager.start_tournament(tournament_id)
    
    async def broadcast_tournament_state(self, tournament_id):
        """
        Broadcast the current tournament state to all participants.
        """
        tournament = self.tournament_manager.tournaments[tournament_id]
        for player in tournament["players"]:
            if player != self:
                try:
                    state = await self.tournament_manager.get_tournament_state(tournament_id)
                    state["your_position"] = player.player_position
                    await player.send(text_data=json.dumps(state))
                except Exception:
                    pass