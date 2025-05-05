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
    Classe simulant un consumer WebSocket pour les appels API REST
    Permet de réutiliser l'infrastructure WebSocket existante
    """
    
    def __init__(self, user=None):
        self.user = user
        self.match_id = None
        self.player_number = None
        self.scope = {"user": user} if user else {}
        self.messages = []
        self.is_connected = True
        self._is_api = True  # Marqueur pour identifier comme client API
        self.channel_name = f"api_consumer_{user.username}_{datetime.now().timestamp()}" if user else "api_consumer_unknown"
        logger.info(f"APIConsumer créé pour {user.username if user else 'utilisateur inconnu'}")
    
    async def send(self, text_data):
        """
        Simule l'envoi de messages WebSocket
        Stocke les messages pour récupération ultérieure par l'API
        """
        try:
            if isinstance(text_data, str):
                data = json.loads(text_data)
            else:
                data = text_data
            
            self.messages.append(data)
            logger.debug(f"Message stocké pour {self.user.username if self.user else 'inconnu'}: {data.get('type', 'unknown')}")
            
            # Traitement spécial pour le matchmaking et la création de partie
            if data.get('type') == 'match_created':
                self.match_id = data.get('match_id')
                self.player_number = data.get('player_number')
                logger.info(f"Match créé pour API user {self.user.username}: match_id={self.match_id}, player_number={self.player_number}")
        except Exception as e:
            logger.error(f"Erreur dans APIConsumer.send: {str(e)}")
            traceback.print_exc()
    
    def get_last_message(self):
        """
        Récupère le dernier message envoyé
        """
        if self.messages:
            return self.messages[-1]
        return None
    
    def get_messages(self):
        """
        Récupère tous les messages envoyés
        """
        return self.messages
    
    def clear_messages(self):
        """
        Efface l'historique des messages
        """
        self.messages = []
    
    async def close(self):
        """
        Simule la fermeture d'une connexion WebSocket
        """
        self.is_connected = False
        logger.info(f"APIConsumer fermé pour {self.user.username if self.user else 'inconnu'}")
    
    # Méthodes supplémentaires pour mieux simuler un consumer WebSocket
    
    def __eq__(self, other):
        """
        Deux APIConsumer sont égaux s'ils représentent le même utilisateur
        """
        if not hasattr(other, 'user') or not self.user or not other.user:
            return False
        return self.user.id == other.user.id

    def __hash__(self):
        """
        Hash basé sur l'ID utilisateur pour pouvoir utiliser dans des collections
        """
        return hash(f"api_{self.user.id}" if self.user else id(self))

class APIMatchConsumer(APIConsumer):
    """
    Version spécifique de l'APIConsumer pour les matchs de Pong
    """
    
    def __init__(self, user=None):
        super().__init__(user)
        logger.info(f"APIMatchConsumer créé pour {user.username if user else 'inconnu'}")
        self.match_task = None
        
    # Méthodes nécessaires à l'intégration avec le MatchConsumer existant
    async def authenticate(self, token):
        """
        Méthode d'authentification simplifiée pour l'API
        L'authentification est déjà gérée par l'API REST
        """
        pass
        
    async def run_game_loop(self, match_id):
        """
        Version simplifiée du game loop pour l'API
        Implémente suffisamment pour que le LobbyManager puisse l'utiliser
        """
        logger.info(f"run_game_loop appelé pour match_id={match_id} par APIMatchConsumer pour {self.user.username}")
        # Récupérer le LobbyManager
        from ..pongLobby import LobbyManager
        lobby_manager = LobbyManager()
        
        try:
            # On vérifie si le match existe
            match_data = lobby_manager.active_matches.get(match_id)
            if not match_data:
                logger.error(f"APIConsumer.run_game_loop: match {match_id} introuvable")
                return
                
            # On récupère le game engine
            from ..pongEngine import GameEngine
            game_engine = GameEngine()
            
            # On récupère les joueurs
            players = match_data["players"]
            game_state = match_data["game_state"]
            
            logger.info(f"APIMatchConsumer: démarrage game loop pour match {match_id} avec joueurs: {[p.user.username for p in players if hasattr(p, 'user')]}")
            
            # Logique similaire à celle du MatchConsumer
            while True:
                # Game speed control
                await asyncio.sleep(0.02)  # 50 FPS
                
                # Check players connection status
                all_connected = all(hasattr(player, 'is_connected') and player.is_connected for player in players)
                if not all_connected:
                    logger.info(f"Match {match_id} terminé: un joueur s'est déconnecté")
                    break
                
                # Update game state
                game_engine.update_game_state(game_state)
                
                # Check for goals
                game_over, winner_username = await game_engine.check_goals(game_state)
                
                if game_over:
                    logger.info(f"Match {match_id} terminé: {winner_username} a gagné")
                    await self.handle_match_result(lobby_manager, match_id, winner_username)
                    break
                
                # Envoyer l'état du jeu aux joueurs
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
        """
        Gère la fin d'un match
        """
        match_data = lobby_manager.active_matches.get(match_id)
        if not match_data:
            return
            
        players = match_data["players"]
        
        # Trouver le gagnant et le perdant
        winner = next((player for player in players if hasattr(player, 'user') and player.user.username == winner_username), None)
        if not winner:
            return
            
        loser = next((player for player in players if player != winner), None)
        
        # Mise à jour ELO
        if winner and loser and hasattr(winner, 'user') and hasattr(loser, 'user'):
            await lobby_manager.update_elo_ratings(winner.user, loser.user)
        
        # Afficher le résultat
        for player in players:
            try:
                await player.send(json.dumps({
                    "type": "game_over",
                    "winner": winner_username,
                    "message": f"{winner_username} a gagné la partie!"
                }))
            except Exception as e:
                logger.error(f"Erreur lors de l'envoi du résultat à {player.user.username if hasattr(player, 'user') else 'inconnu'}: {e}")
        
        # Nettoyage
        if match_id in lobby_manager.active_matches:
            del lobby_manager.active_matches[match_id]