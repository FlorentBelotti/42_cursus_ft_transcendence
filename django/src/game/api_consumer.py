"""
╔═══════════════════════════════════════════════════╗
║                 APIConsumer                       ║
╠═══════════════════════════════════════════════════╣
║ Adaptateur pour interfacer les appels API REST    ║
║ avec le système WebSocket existant                ║
║                                                   ║
║ • Simule les méthodes d'un WebSocket consumer     ║
║ • Permet d'utiliser l'infrastructure existante    ║
║ • Gère les requêtes API comme des clients WS      ║
╚═══════════════════════════════════════════════════╝
"""

import json
import asyncio
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async

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
    
    async def send(self, text_data):
        """
        Simule l'envoi de messages WebSocket
        Stocke les messages pour récupération ultérieure par l'API
        """
        self.messages.append(json.loads(text_data))
    
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
        pass

class APIMatchConsumer(APIConsumer):
    """
    Version spécifique de l'APIConsumer pour les matchs de Pong
    """
    
    def __init__(self, user=None):
        super().__init__(user)
        
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
        """
        pass