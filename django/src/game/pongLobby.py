import asyncio
import json
import logging
from datetime import datetime
from .pongHelper import calculate_elo_change, now_str, create_initial_game_state
from random import random
from channels.db import database_sync_to_async

# Configuration du logger
logger = logging.getLogger('pong.lobby')

class LobbyManager:
    """
    ╔═══════════════════════════════════════════════════╗
    ║                 LobbyManager                      ║
    ╠═══════════════════════════════════════════════════╣
    ║ Matchmaking system for Pong games                 ║
    ║                                                   ║
    ║ • Manages player queue and ELO-based matching     ║
    ║ • Creates and tracks active game sessions         ║
    ║ • Handles invitations and direct challenges       ║
    ║ • Processes disconnections and game forfeitures   ║
    ╚═══════════════════════════════════════════════════╝
    """

    # Utilisation d'un singleton pour le LobbyManager
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LobbyManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """
        Initialize the lobby manager for matchmaking.
        """
        if self._initialized:
            return
            
        self.waiting_players = []
        self.active_matches = {}
        self.invited_games = {}
        self.matchmaking_lock = asyncio.Lock()
        self._initialized = True
        logger.info("LobbyManager initialisé")

    #===========================================================#
    #                INVITE MANAGEMENT                          #
    #===========================================================#

    async def create_match_from_invitation(self, player1, player2, match_id=None):
        """
        Create a match between two players from an invitation.
        """
        logger.info(f"Création d'un match depuis une invitation: {player1.user.username} vs {player2.user.username}, match_id={match_id}")
        print(f"Creating match from invitation: {player1.user.username} vs {player2.user.username}, match_id={match_id}")

        # Set player numbers
        player1.player_number = 1
        player2.player_number = 2

        # Generate/use match id
        if not match_id:
            match_id = f"invite_{player1.user.username}_vs_{player2.user.username}_{now_str()}"

        # Initial game state
        game_state = create_initial_game_state(player1, player2)

        # Assign match ID
        player1.match_id = match_id
        player2.match_id = match_id

        # Store the match in active_matches
        self.active_matches[match_id] = {
            "players": [player1, player2],
            "game_state": game_state,
            "created_at": now_str(),
            "invitation_based": True
        }

        logger.info(f"Match {match_id} créé et stocké dans active_matches")
        print(f"Match {match_id} created and stored in active_matches")

        # Stop matchmaking
        if hasattr(player1, 'match_task') and player1.match_task:
            player1.match_task.cancel()
        if hasattr(player2, 'match_task') and player2.match_task:
            player2.match_task.cancel()

        # Notify players
        await player1.send(text_data=json.dumps({
            "type": "match_created",
            "match_id": match_id,
            "player_number": 1,
            "opponent": player2.user.username,
            "game_state": game_state
        }))

        await player2.send(text_data=json.dumps({
            "type": "match_created",
            "match_id": match_id,
            "player_number": 2,
            "opponent": player1.user.username,
            "game_state": game_state
        }))

        # Cleanup invited game
        if match_id in self.invited_games:
            logger.info(f"Suppression de l'invitation {match_id}")
            print(f"Removing invitation {match_id} from invited_games")
            del self.invited_games[match_id]

        # Start game loop
        try:
            logger.info(f"Démarrage de la boucle de jeu pour le match {match_id}")
            print(f"Starting game loop for match {match_id}")
            asyncio.create_task(player1.run_game_loop(match_id))
        except Exception as e:
            logger.error(f"Erreur lors du démarrage de la boucle de jeu: {e}")
            print(f"Error starting game loop: {e}")

        return match_id

    #===========================================================#
    #                MATCHMAKING MANAGEMENT                     #
    #===========================================================#

    async def add_player_to_queue(self, player):
        """
        Add a player to the matchmaking queue.
        """
        # Vérifier si joueur est déjà dans un match
        if hasattr(player, 'match_id') and player.match_id:
            logger.warning(f"Joueur {player.user.username} déjà dans un match actif {player.match_id}, ne peut pas rejoindre la file d'attente")
            await player.send(text_data=json.dumps({
                "type": "error",
                "message": "Vous êtes déjà dans un match actif. Impossible de rechercher un autre adversaire."
            }))
            return

        # Vérifier si joueur est déjà dans la file d'attente
        for existing_player, _, _ in self.waiting_players:
            if existing_player == player:
                logger.info(f"Joueur {player.user.username} déjà dans la file d'attente")
                print(f"Player {player.user.username} is already in queue")
                return
        
        logger.info(f"Ajout de {player.user.username} à la file d'attente de matchmaking")
        print(f"Adding {player.user.username} to matchmaking queue")
        
        # Timestamp pour le temps d'attente
        current_time = asyncio.get_event_loop().time()
        
        # ELO du joueur pour matchmaking basé sur niveau
        player_elo = player.user.elo if hasattr(player.user, 'elo') else 1000
        
        # Ajouter à la file d'attente
        self.waiting_players.append((
            player, 
            current_time,
            player_elo
        ))
        
        # Afficher tous les joueurs en attente pour debug
        wait_players_info = [(p.user.username, ts, elo) for p, ts, elo in self.waiting_players if hasattr(p, 'user')]
        logger.info(f"Joueurs en attente: {wait_players_info}")
        
        # Notifier le joueur qu'il est en attente
        await player.send(text_data=json.dumps({
            "type": "waiting",
            "message": "En attente d'un adversaire...",
            "queue_position": len(self.waiting_players)
        }))
        
        # Essayer de trouver un match immédiatement
        await self.find_match_for_player(player)

    async def find_match_for_player(self, player):
        """
        Find a suitable match for a player based on ELO rating.
        """
        if not self.waiting_players:
            logger.debug("Pas de joueurs en attente")
            return False
        
        # Récupérer l'ELO du joueur
        my_elo = player.user.elo if hasattr(player.user, 'elo') else 1000
        best_match = None
        min_elo_diff = float('inf')
        
        logger.info(f"Recherche d'un match pour {player.user.username} (ELO: {my_elo})")
        
        # Parcourir tous les joueurs en attente
        for i, (waiting_player, timestamp, elo) in enumerate(self.waiting_players):
            # Ne pas matcher avec soi-même
            if waiting_player == player:
                continue
            
            # Vérifier si le joueur est déjà dans un match
            if hasattr(waiting_player, 'match_id') and waiting_player.match_id:
                logger.warning(f"Joueur {waiting_player.user.username} déjà dans un match, ignoré")
                continue
                
            # Calculer la différence d'ELO avec ajustement temporel
            elo_diff = abs(my_elo - elo)
            wait_time = asyncio.get_event_loop().time() - timestamp
            adjusted_diff = elo_diff / (1 + 0.1 * wait_time)
            
            # Vérifier le type de client (API vs WebSocket)
            is_api_mix = (hasattr(player, '_is_api') != hasattr(waiting_player, '_is_api'))
            
            logger.debug(f"Candidat: {waiting_player.user.username}, ELO: {elo}, diff: {elo_diff}, wait: {wait_time:.1f}s, adjusted: {adjusted_diff:.1f}, API mix: {is_api_mix}")
            
            # Favoriser légèrement les matchs entre clients API et web pour le test
            if is_api_mix:
                adjusted_diff *= 0.8  # 20% de bonus pour faciliter le match API-Web
            
            # Gardons le meilleur match
            if adjusted_diff < min_elo_diff:
                min_elo_diff = adjusted_diff
                best_match = (i, waiting_player)
        
        # Faire le match si on en trouve un bon ou si l'attente est longue
        if best_match and (min_elo_diff < 200 or 
                          asyncio.get_event_loop().time() - self.waiting_players[best_match[0]][1] > 10):
            matched_idx, matched_player = best_match
            
            # Log détaillé du match
            is_api_p1 = hasattr(player, '_is_api')
            is_api_p2 = hasattr(matched_player, '_is_api')
            logger.info(f"Match trouvé: {player.user.username} (ELO {my_elo}, {'API' if is_api_p1 else 'WEB'}) vs "
                        f"{matched_player.user.username} (ELO {self.waiting_players[matched_idx][2]}, {'API' if is_api_p2 else 'WEB'}), "
                        f"diff: {min_elo_diff:.2f}")
            
            # Supprimer le joueur de la file d'attente
            try:
                del self.waiting_players[matched_idx]
            except Exception as e:
                logger.error(f"Erreur lors de la suppression du joueur {matched_player.user.username} de la file d'attente: {e}")
            
            # Créer la partie
            await self.create_match(player, matched_player)
            return True
        
        logger.debug(f"Aucun match trouvé pour {player.user.username}")
        return False
    
    async def find_matches_for_all(self):
        """
        Try to find matches for all players in the waiting queue.
        """
        if len(self.waiting_players) < 2:
            return 0
            
        matches_created = 0
        players_to_remove = []
        
        # Log des joueurs en attente
        wait_players_info = [(p.user.username, ts, elo) for p, ts, elo in self.waiting_players if hasattr(p, 'user')]
        logger.info(f"Recherche de matchs pour {len(self.waiting_players)} joueurs en attente: {wait_players_info}")
        
        # Parcourir tous les joueurs en attente (du plus ancien au plus récent)
        for i, (player, timestamp, player_elo) in enumerate(self.waiting_players):
            if i in players_to_remove:
                continue
                
            # Vérifier si le joueur est déjà dans un match
            if hasattr(player, 'match_id') and player.match_id:
                logger.warning(f"Joueur {player.user.username} déjà dans un match {player.match_id}, retiré de la file d'attente")
                players_to_remove.append(i)
                continue
                
            # Chercher le meilleur adversaire
            best_match = None
            min_elo_diff = float('inf')
            
            # Parcourir tous les autres joueurs en attente
            for j, (other_player, other_timestamp, other_elo) in enumerate(self.waiting_players):
                if i == j or j in players_to_remove:
                    continue
                    
                # Vérifier si l'autre joueur est déjà dans un match
                if hasattr(other_player, 'match_id') and other_player.match_id:
                    logger.warning(f"Joueur {other_player.user.username} déjà dans un match, ignoré")
                    if j not in players_to_remove:
                        players_to_remove.append(j)
                    continue
                
                # Calculer la différence d'ELO avec ajustement temporel
                elo_diff = abs(player_elo - other_elo)
                wait_time = asyncio.get_event_loop().time() - other_timestamp
                adjusted_diff = elo_diff / (1 + 0.1 * wait_time)
                
                # Vérifier le type de client (API vs WebSocket)
                is_api_p1 = hasattr(player, '_is_api')
                is_api_p2 = hasattr(other_player, '_is_api')
                is_api_mix = (is_api_p1 != is_api_p2)
                
                # Favoriser légèrement les matchs entre clients API et web pour le test
                if is_api_mix:
                    adjusted_diff *= 0.8  # 20% de bonus pour faciliter le match API-Web
                
                # Log détaillé du match potentiel
                logger.debug(f"Match potentiel: {player.user.username} (ELO {player_elo}, {'API' if is_api_p1 else 'WEB'}) vs "
                            f"{other_player.user.username} (ELO {other_elo}, {'API' if is_api_p2 else 'WEB'}), "
                            f"diff: {elo_diff}, adjusted: {adjusted_diff:.2f}, wait: {wait_time:.1f}s")
                
                # Garder le meilleur match
                if adjusted_diff < min_elo_diff:
                    min_elo_diff = adjusted_diff
                    best_match = (j, other_player)
            
            # Faire le match si on trouve un bon adversaire ou si l'attente est longue
            if best_match and (min_elo_diff < 200 or asyncio.get_event_loop().time() - timestamp > 10):
                matched_idx, matched_player = best_match
                
                # Log du match
                is_api_p1 = hasattr(player, '_is_api')
                is_api_p2 = hasattr(matched_player, '_is_api')
                logger.info(f"Match créé: {player.user.username} (ELO {player_elo}, {'API' if is_api_p1 else 'WEB'}) vs "
                            f"{matched_player.user.username} (ELO {other_elo}, {'API' if is_api_p2 else 'WEB'})")
                
                # Créer le match
                await self.create_match(player, matched_player)
                
                # Marquer les joueurs pour suppression de la file d'attente
                players_to_remove.extend([i, matched_idx])
                matches_created += 1
        
        # Supprimer les joueurs matchés de la file d'attente (en ordre décroissant pour éviter les problèmes d'indices)
        for idx in sorted(players_to_remove, reverse=True):
            if idx < len(self.waiting_players):
                del self.waiting_players[idx]
        
        logger.info(f"{matches_created} matches créés, {len(self.waiting_players)} joueurs toujours en attente")
        return matches_created
    
    async def create_match(self, player1, player2):
        """
        Create a match between two players.
        """
        # Définir les numéros de joueur
        player1.player_number = 1
        player2.player_number = 2
        
        # Générer un ID de match unique
        match_id = f"match_{player1.user.username}_vs_{player2.user.username}_{now_str()}"
        logger.info(f"Création du match {match_id}")
        
        # Créer l'état initial du jeu
        game_state = create_initial_game_state(player1, player2)
        
        # Stocker le match
        self.active_matches[match_id] = {
            "players": [player1, player2],
            "game_state": game_state,
            "created_at": now_str()
        }
        
        # Annuler les tâches de matchmaking si existantes
        if hasattr(player1, 'match_task') and player1.match_task:
            player1.match_task.cancel()
        if hasattr(player2, 'match_task') and player2.match_task:
            player2.match_task.cancel()
        
        # Notifier les joueurs
        for player in [player1, player2]:
            player.match_id = match_id
            await player.send(text_data=json.dumps({
                "type": "match_created",
                "match_id": match_id,
                "player_number": player.player_number,
                "opponent": player2.user.username if player == player1 else player1.user.username,
                "game_state": game_state
            }))
        
        # Démarrer la boucle de jeu
        is_api_player1 = hasattr(player1, '_is_api')
        is_api_player2 = hasattr(player2, '_is_api')
        logger.info(f"Démarrage de la boucle de jeu pour le match {match_id} entre {player1.user.username} ({'API' if is_api_player1 else 'WEB'}) et {player2.user.username} ({'API' if is_api_player2 else 'WEB'})")
        asyncio.create_task(player1.run_game_loop(match_id))
        return match_id
    
    async def remove_player(self, player):
        """
        Remove a player from the waiting queue.
        """
        async with self.matchmaking_lock:
            # Supprimer de la file d'attente
            original_length = len(self.waiting_players)
            self.waiting_players = [(p, ts, elo) for p, ts, elo in self.waiting_players if p != player]
            
            # Gérer le forfait si le joueur est dans un match
            for match_id, match_data in list(self.active_matches.items()):
                if player in match_data["players"]:
                    # Notifier l'adversaire de la victoire par forfait
                    opponent = next((p for p in match_data["players"] if p != player), None)
                    if opponent:
                        logger.info(f"Joueur {player.user.username} a quitté le match {match_id}, {opponent.user.username} gagne par forfait")
                        await opponent.send(text_data=json.dumps({
                            "type": "game_over",
                            "winner": opponent.user.username,
                            "message": f"Victoire par abandon ! {player.user.username} a quitté la partie."
                        }))
                        await self.update_elo_for_forfeit(opponent.user, player.user)
                    
                    # Supprimer le match
                    del self.active_matches[match_id]
            
            return original_length > len(self.waiting_players)
    
    @database_sync_to_async
    def update_elo_for_forfeit(self, winner, loser, forfeit_penalty=5):
        """
        Updates ELO ratings when a player forfeits.
        """
        winner_elo, loser_elo = calculate_elo_change(winner.elo, loser.elo)
        
        # Appliquer une pénalité supplémentaire pour forfait
        loser_elo -= forfeit_penalty
        
        # Mettre à jour les statistiques
        winner.elo = winner_elo
        loser.elo = loser_elo
        winner.wins += 1
        loser.losses += 1
        
        # Enregistrer dans l'historique
        timestamp = now_str()
        winner.history.append({
            'opponent_id': loser.id,
            'opponent_username': loser.username,
            'result': 'win',
            'timestamp': timestamp,
            'match_type': 'forfeit'
        })
        loser.history.append({
            'opponent_id': winner.id,
            'opponent_username': winner.username,
            'result': 'forfeit',
            'timestamp': timestamp,
            'match_type': 'forfeit'
        })
        winner.save()
        loser.save()
        logger.info(f"ELO mis à jour après forfait: {winner.username} (+{winner_elo - winner.elo}), {loser.username} (-{loser.elo - loser_elo + forfeit_penalty})")
        
    @database_sync_to_async
    def update_elo_ratings(self, winner, loser, K=32):
        """
        Updates ELO ratings after a match.
        """
        from .pongHelper import calculate_elo_change

        # Calculer les nouveaux ELO
        winner_elo, loser_elo = calculate_elo_change(winner.elo, loser.elo, K)
        
        # Enregistrer les statistiques
        old_winner_elo = winner.elo
        old_loser_elo = loser.elo
        winner.elo = winner_elo
        loser.elo = loser_elo
        winner.wins += 1
        loser.losses += 1

        # Enregistrer dans l'historique
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
        logger.info(f"ELO mis à jour: {winner.username} ({old_winner_elo} → {winner_elo}, +{winner_elo - old_winner_elo}), {loser.username} ({old_loser_elo} → {loser_elo}, {loser_elo - old_loser_elo})")