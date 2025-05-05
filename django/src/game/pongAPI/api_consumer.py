import json
import asyncio
import logging
import traceback
from datetime import datetime
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async

# DEBUG
logger = logging.getLogger('pong.api')

class APIConsumer:
    
    def __init__(self, user=None):
        self.user = user
        self.match_id = None
        self.player_number = None
        self.scope = {"user": user} if user else {}
        self.messages = []
        self.is_connected = True
        self._is_api = True
        self.channel_name = f"api_consumer_{user.username}_{datetime.now().timestamp()}" if user else "api_consumer_unknown"
        logger.info(f"APIConsumer créé pour {user.username if user else 'utilisateur inconnu'}")
    
    async def send(self, text_data):
        try:
            if isinstance(text_data, str):
                data = json.loads(text_data)
            else:
                data = text_data
            
            self.messages.append(data)
            logger.debug(f"Message stocké pour {self.user.username if self.user else 'inconnu'}: {data.get('type', 'unknown')}")
            
            # MATCHMAKING QUEUE
            if data.get('type') == 'match_created':
                self.match_id = data.get('match_id')
                self.player_number = data.get('player_number')
                logger.info(f"Match créé pour API user {self.user.username}: match_id={self.match_id}, player_number={self.player_number}")
        except Exception as e:
            logger.error(f"Erreur dans APIConsumer.send: {str(e)}")
            traceback.print_exc()
    
    def get_last_message(self):
        if self.messages:
            return self.messages[-1]
        return None
    
    def get_messages(self):
        return self.messages
    
    def clear_messages(self):
        self.messages = []
    
    async def close(self):
        self.is_connected = False
        logger.info(f"APIConsumer fermé pour {self.user.username if self.user else 'inconnu'}")
    
    # WEBSOCKET

    # CHECK USER=USER
    def __eq__(self, other):
        if not hasattr(other, 'user') or not self.user or not other.user:
            return False
        return self.user.id == other.user.id

    # SEARCH WITH ID
    def __hash__(self):
        return hash(f"api_{self.user.id}" if self.user else id(self))

class APIMatchConsumer(APIConsumer): 
    def __init__(self, user=None):
        super().__init__(user)
        logger.info(f"APIMatchConsumer créé pour {user.username if user else 'inconnu'}")
        self.match_task = None
        
    # MATCHCONSUMER - MATCHMAKING
    async def authenticate(self, token):
        pass
        
    async def run_game_loop(self, match_id):
        logger.info(f"run_game_loop appelé pour match_id={match_id} par APIMatchConsumer pour {self.user.username}")
        
        # CREATE LOBBY
        from ..pongLobby import LobbyManager
        lobby_manager = LobbyManager()
        
        try:
            # IS MATCH OK
            match_data = lobby_manager.active_matches.get(match_id)
            if not match_data:
                logger.error(f"APIConsumer.run_game_loop: match {match_id} introuvable")
                return
                
            # CREATE GAME
            from ..pongEngine import GameEngine
            game_engine = GameEngine()
            
            # GET PLAYER
            players = match_data["players"]
            game_state = match_data["game_state"]
            
            logger.info(f"APIMatchConsumer: démarrage game loop pour match {match_id} avec joueurs: {[p.user.username for p in players if hasattr(p, 'user')]}")
            
            # MATCHCONSUMMER COPY
            while True:
                await asyncio.sleep(0.02)  # 50 FPS
                all_connected = all(hasattr(player, 'is_connected') and player.is_connected for player in players)
                if not all_connected:
                    logger.info(f"Match {match_id} terminé: un joueur s'est déconnecté")
                    break
                game_engine.update_game_state(game_state)
                game_over, winner_username = await game_engine.check_goals(game_state)
                if game_over:
                    logger.info(f"Match {match_id} terminé: {winner_username} a gagné")
                    await self.handle_match_result(lobby_manager, match_id, winner_username)
                    break
                for player in players:
                    if hasattr(player, 'send'):
                        await player.send(json.dumps({
                            "type": "game_state",
                            "game_state": game_state
                        }))
        
        except asyncio.CancelledError:
            logger.info(f"Game loop annulée pour match {match_id}")
        except Exception as e:
            logger.error(f"Erreur dans game loop pour match {match_id}: {e}")
            traceback.print_exc()
    
    async def handle_match_result(self, lobby_manager, match_id, winner_username):
        match_data = lobby_manager.active_matches.get(match_id)
        if not match_data:
            return
            
        players = match_data["players"]
        winner = next((player for player in players if hasattr(player, 'user') and player.user.username == winner_username), None)
        if not winner:
            return
        loser = next((player for player in players if player != winner), None)
        if winner and loser and hasattr(winner, 'user') and hasattr(loser, 'user'):
            await lobby_manager.update_elo_ratings(winner.user, loser.user)
        for player in players:
            try:
                await player.send(json.dumps({
                    "type": "game_over",
                    "winner": winner_username,
                    "message": f"{winner_username} a gagné la partie!"
                }))
            except Exception as e:
                logger.error(f"Erreur lors de l'envoi du résultat à {player.user.username if hasattr(player, 'user') else 'inconnu'}: {e}")
        if match_id in lobby_manager.active_matches:
            del lobby_manager.active_matches[match_id]