"""
╔═══════════════════════════════════════════════════╗
║                 APIConsumer                       ║
╠═══════════════════════════════════════════════════╣
║ Adapter to interface REST API calls               ║
║ with the existing WebSocket system                ║
║                                                   ║
║ • Simulates WebSocket consumer methods            ║
║ • Allows using existing infrastructure            ║
║ • Handles API requests as WS clients              ║
╚═══════════════════════════════════════════════════╝
"""

import json
import asyncio
import logging
import traceback
from datetime import datetime
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async

logger = logging.getLogger('pong.api')

class APIConsumer:
    """
    Class simulating a WebSocket consumer for REST API calls
    Allows reusing existing WebSocket infrastructure
    """
    
    def __init__(self, user=None):
        self.user = user
        self.match_id = None
        self.player_number = None
        self.scope = {"user": user} if user else {}
        self.messages = []
        self.is_connected = True
        self._is_api = True  # Marker to identify as API client
        self.channel_name = f"api_consumer_{user.username}_{datetime.now().timestamp()}" if user else "api_consumer_unknown"
        logger.info(f"APIConsumer created for {user.username if user else 'unknown user'}")
    
    async def send(self, text_data):
        """
        Simulates WebSocket message sending
        Stores messages for later retrieval by the API
        """
        try:
            if isinstance(text_data, str):
                data = json.loads(text_data)
            else:
                data = text_data
            
            self.messages.append(data)
            logger.debug(f"Message stored for {self.user.username if self.user else 'unknown'}: {data.get('type', 'unknown')}")
            
            # Special handling for matchmaking and match creation
            if data.get('type') == 'match_created':
                self.match_id = data.get('match_id')
                self.player_number = data.get('player_number')
                logger.info(f"Match created for API user {self.user.username}: match_id={self.match_id}, player_number={self.player_number}")
        except Exception as e:
            logger.error(f"Error in APIConsumer.send: {str(e)}")
            traceback.print_exc()
    
    def get_last_message(self):
        """
        Gets the last sent message
        """
        if self.messages:
            return self.messages[-1]
        return None
    
    def get_messages(self):
        """
        Gets all sent messages
        """
        return self.messages
    
    def clear_messages(self):
        """
        Clears the message history
        """
        self.messages = []
    
    async def close(self):
        """
        Simulates closing a WebSocket connection
        """
        self.is_connected = False
        logger.info(f"APIConsumer closed for {self.user.username if self.user else 'unknown'}")
    
    # Additional methods to better simulate a WebSocket consumer
    
    def __eq__(self, other):
        """
        Two APIConsumers are equal if they represent the same user
        """
        if not hasattr(other, 'user') or not self.user or not other.user:
            return False
        return self.user.id == other.user.id

    def __hash__(self):
        """
        Hash based on user ID for use in collections
        """
        return hash(f"api_{self.user.id}" if self.user else id(self))

class APIMatchConsumer(APIConsumer):
    """
    Specific version of APIConsumer for Pong matches
    """
    
    def __init__(self, user=None):
        super().__init__(user)
        logger.info(f"APIMatchConsumer created for {user.username if user else 'unknown'}")
        self.match_task = None
        
    # Methods necessary for integration with existing MatchConsumer
    async def authenticate(self, token):
        """
        Simplified authentication method for the API
        Authentication is already handled by the REST API
        """
        pass
        
    async def run_game_loop(self, match_id):
        """
        Simplified game loop version for the API
        Implements enough for the LobbyManager to use it
        """
        logger.info(f"run_game_loop called for match_id={match_id} by APIMatchConsumer for {self.user.username}")
        # Get the LobbyManager
        from .pongLobby import LobbyManager
        lobby_manager = LobbyManager()
        
        try:
            # Check if match exists
            match_data = lobby_manager.active_matches.get(match_id)
            if not match_data:
                logger.error(f"APIConsumer.run_game_loop: match {match_id} not found")
                return
                
            # Get the game engine
            from .pongEngine import GameEngine
            game_engine = GameEngine()
            
            # Get the players
            players = match_data["players"]
            game_state = match_data["game_state"]
            
            logger.info(f"APIMatchConsumer: starting game loop for match {match_id} with players: {[p.user.username for p in players if hasattr(p, 'user')]}")
            
            # Logic similar to MatchConsumer
            while True:
                # Game speed control
                await asyncio.sleep(0.02)  # 50 FPS
                
                # Check players connection status
                all_connected = all(hasattr(player, 'is_connected') and player.is_connected for player in players)
                if not all_connected:
                    logger.info(f"Match {match_id} ended: a player disconnected")
                    break
                
                # Update game state
                game_engine.update_game_state(game_state)
                
                # Check for goals
                game_over, winner_username = await game_engine.check_goals(game_state)
                
                if game_over:
                    logger.info(f"Match {match_id} ended: {winner_username} won")
                    await self.handle_match_result(lobby_manager, match_id, winner_username)
                    break
                
                # Send game state to players
                for player in players:
                    if hasattr(player, 'send'):
                        await player.send(json.dumps({
                            "type": "game_state",
                            "game_state": game_state
                        }))
        
        except asyncio.CancelledError:
            logger.info(f"Game loop cancelled for match {match_id}")
        except Exception as e:
            logger.error(f"Error in game loop for match {match_id}: {e}")
            traceback.print_exc()
    
    async def handle_match_result(self, lobby_manager, match_id, winner_username):
        """
        Handles the end of a match
        """
        match_data = lobby_manager.active_matches.get(match_id)
        if not match_data:
            return
            
        players = match_data["players"]
        
        # Find the winner and loser
        winner = next((player for player in players if hasattr(player, 'user') and player.user.username == winner_username), None)
        if not winner:
            return
            
        loser = next((player for player in players if player != winner), None)
        
        # Update ELO
        if winner and loser and hasattr(winner, 'user') and hasattr(loser, 'user'):
            await lobby_manager.update_elo_ratings(winner.user, loser.user)
        
        # Show result
        for player in players:
            try:
                await player.send(json.dumps({
                    "type": "game_over",
                    "winner": winner_username,
                    "message": f"{winner_username} won the game!"
                }))
            except Exception as e:
                logger.error(f"Error while sending result to {player.user.username if hasattr(player, 'user') else 'unknown'}: {e}")
        
        # Cleanup
        if match_id in lobby_manager.active_matches:
            del lobby_manager.active_matches[match_id]