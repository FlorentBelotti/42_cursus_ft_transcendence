import asyncio
import json
from datetime import datetime
from .pongHelper import calculate_elo_change, now_str, create_initial_game_state
from random import random
from channels.db import database_sync_to_async

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

    def __init__(self):
        """
        Initialize the lobby manager for matchmaking.
        """

        self.waiting_players = []
        self.active_matches = {}
        self.invited_games = {}
        self.matchmaking_lock = asyncio.Lock()

    #===========================================================#
    #                INVITE MANAGEMENT                          #
    #===========================================================#

    async def create_match_from_invitation(self, player1, player2, match_id=None):
        """
        Create a match between two players from an invitation.
        """

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
            print(f"Removing invitation {match_id} from invited_games")
            del self.invited_games[match_id]

        # Start game loop
        try:
            print(f"Starting game loop for match {match_id}")
            asyncio.create_task(player1.run_game_loop(match_id))
        except Exception as e:
            print(f"Error starting game loop: {e}")

        return match_id

    #===========================================================#
    #                MATCHMAKING MANAGEMENT                     #
    #===========================================================#

    async def add_player_to_queue(self, player):
        """
        Add a player to the matchmaking queue.
        """

        # Vérifier si le joueur est déjà dans un match actif
        if hasattr(player, 'match_id') and player.match_id:
            print(f"Player {player.user.username} is already in match {player.match_id}, not adding to queue")
            await player.send(text_data=json.dumps({
                "type": "error",
                "message": "Vous êtes déjà dans un match actif. Impossible de rechercher un autre adversaire."
            }))
            return

        # Check if player is in queue
        for existing_player, _, _ in self.waiting_players:
            if existing_player == player:
                print(f"Player {player.user.username} is already in queue")
                return
        
        print(f"Adding {player.user.username} to matchmaking queue")
        
        # Timestamp
        current_time = asyncio.get_event_loop().time()
        
        # Elo based matchmaking
        self.waiting_players.append((
            player, 
            current_time,
            player.user.elo if hasattr(player.user, 'elo') else 1000
        ))
        
        # Notify waiting
        await player.send(text_data=json.dumps({
            "type": "waiting",
            "message": "En attente d'un adversaire...",
            "queue_position": len(self.waiting_players)
        }))
        
        # Find match
        await self.find_match_for_player(player)

    async def find_match_for_player(self, player):
        """
        Find a suitable match for a player based on ELO rating.
        """

        if not self.waiting_players:
            return False
        
        my_elo = player.user.elo
        best_match = None
        min_elo_diff = float('inf')
        
        for i, (waiting_player, timestamp, elo) in enumerate(self.waiting_players):
            if waiting_player == player:
                continue
                
            # DEBUG 1
            if hasattr(waiting_player, 'match_id') and waiting_player.match_id:
                print(f"Skipping player {waiting_player.user.username} as they are already in match {waiting_player.match_id}")
                continue
                
            elo_diff = abs(my_elo - elo)
            wait_time = asyncio.get_event_loop().time() - timestamp
            adjusted_diff = elo_diff / (1 + 0.1 * wait_time)
            if adjusted_diff < min_elo_diff:
                min_elo_diff = adjusted_diff
                best_match = (i, waiting_player)
        
        # Match ELO
        if best_match and (min_elo_diff < 18 or 
                          asyncio.get_event_loop().time() - self.waiting_players[best_match[0]][1] > 30):
            matched_idx, matched_player = best_match
            
            # Remove matched player from queue
            del self.waiting_players[matched_idx]
            # Create game between the two players
            await self.create_match(player, matched_player)
            return True
        
        return False
    
    async def find_matches_for_all(self):
        """
        Try to find matches for all players in the waiting queue.
        """

        if len(self.waiting_players) < 2:
            return 0
            
        matches_created = 0
        players_to_remove = []
        
        # Scan from longest wait to shortest
        for i, (player, timestamp, _) in enumerate(self.waiting_players):
            if i in players_to_remove:
                continue
                
            # DEBUG 1
            if hasattr(player, 'match_id') and player.match_id:
                print(f"Skipping player {player.user.username} as they are already in match {player.match_id}")
                players_to_remove.append(i)
                continue
                
            # Find best match
            best_match = None
            min_elo_diff = float('inf')
            
            for j, (other_player, other_timestamp, other_elo) in enumerate(self.waiting_players):
                if i == j or j in players_to_remove:
                    continue
                    
                # DEBUG 2 
                if hasattr(other_player, 'match_id') and other_player.match_id:
                    print(f"Skipping player {other_player.user.username} as they are already in match {other_player.match_id}")
                    if j not in players_to_remove:
                        players_to_remove.append(j)
                    continue
                    
                elo_diff = abs(player.user.elo - other_elo)
                wait_time = asyncio.get_event_loop().time() - other_timestamp
                adjusted_diff = elo_diff / (1 + 0.1 * wait_time)
                if adjusted_diff < min_elo_diff:
                    min_elo_diff = adjusted_diff
                    best_match = (j, other_player)
            
            # Match found
            if best_match and (min_elo_diff < 18 or asyncio.get_event_loop().time() - timestamp > 30):
                matched_idx, matched_player = best_match
                await self.create_match(player, matched_player)
                # Remove players from queue
                players_to_remove.extend([i, matched_idx])
                matches_created += 1
        
        # Remove matched players from queue (reverse)
        for idx in sorted(players_to_remove, reverse=True):
            if idx < len(self.waiting_players):
                del self.waiting_players[idx]
                
        return matches_created
    
    async def create_match(self, player1, player2):
        """
        Create a match between two players.
        """

        # Set player numbers
        player1.player_number = 1
        player2.player_number = 2
        
        # Generate match ID
        match_id = f"match_{player1.user.username}_vs_{player2.user.username}_{now_str()}"
        
        # Create initial game state
        game_state = create_initial_game_state(player1, player2)
        
        # Assign match ID
        self.active_matches[match_id] = {
            "players": [player1, player2],
            "game_state": game_state,
            "created_at": now_str()
        }
        
        # Cancel any matchmaking tasks
        if hasattr(player1, 'match_task') and player1.match_task:
            player1.match_task.cancel()
        if hasattr(player2, 'match_task') and player2.match_task:
            player2.match_task.cancel()
        
        # Notify players
        for player in [player1, player2]:
            player.match_id = match_id
            await player.send(text_data=json.dumps({
                "type": "match_created",
                "match_id": match_id,
                "player_number": player.player_number,
                "opponent": player2.user.username if player == player1 else player1.user.username,
                "game_state": game_state
            }))
        
        # Game loop
        asyncio.create_task(player1.run_game_loop(match_id))
        return match_id
    
    async def remove_player(self, player):
        """
        Remove a player from the waiting queue.
        """

        async with self.matchmaking_lock:
            # Check if player is in queue
            original_length = len(self.waiting_players)
            self.waiting_players = [(p, ts, elo) for p, ts, elo in self.waiting_players if p != player]
            
            # Handle forfeit if player is in match
            for match_id, match_data in list(self.active_matches.items()):
                if player in match_data["players"]:
                    # Notify opponent of win by forfeit
                    opponent = next((p for p in match_data["players"] if p != player), None)
                    if opponent:
                        await opponent.send(text_data=json.dumps({
                            "type": "game_over",
                            "winner": opponent.user.username,
                            "message": f"Victoire par abandon ! {player.user.username} a quitté la partie."
                        }))
                        await self.update_elo_for_forfeit(opponent.user, player.user)
                    
                    # Remove the match
                    del self.active_matches[match_id]
            
            return original_length > len(self.waiting_players)
    
    @database_sync_to_async
    def update_elo_for_forfeit(self, winner, loser, forfeit_penalty=5):
        """
        Updates ELO ratings when a player forfeits.
        """

        winner_elo, loser_elo = calculate_elo_change(winner.elo, loser.elo)
        
        # Penalty
        loser_elo -= forfeit_penalty
        
        # Records
        winner.elo = winner_elo
        loser.elo = loser_elo
        winner.wins += 1
        loser.losses += 1
        
        # Match history
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