import asyncio
import json
from datetime import datetime
from .pongHelper import calculate_elo_change, now_str, create_initial_game_state
from random import random
from channels.db import database_sync_to_async

class LobbyManager:
    def __init__(self):
        """
        Initialize the lobby manager for matchmaking.
        """
        self.waiting_players = []
        self.active_matches = {}
        self.invited_games = {}  # Store invited games waiting for second player
        self.matchmaking_lock = asyncio.Lock()

    async def create_match_from_invitation(self, player1, player2, match_id=None):
        """
        Create a match between two players from an invitation.

        Args:
            player1: First player (invitation sender)
            player2: Second player (invitation recipient)
            match_id: Optional ID to use for the match

        Returns:
            str: Match ID of the created match
        """
        print(f"Creating match from invitation: {player1.user.username} vs {player2.user.username}, match_id={match_id}")

        # Set player numbers explicitly to be sure
        player1.player_number = 1
        player2.player_number = 2

        # Use provided match ID or generate one
        if not match_id:
            match_id = f"invite_{player1.user.username}_vs_{player2.user.username}_{now_str()}"

        # Create initial game state
        game_state = create_initial_game_state(player1, player2)

        # Assign match ID to both players
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

        # Cancel any matchmaking tasks
        if hasattr(player1, 'match_task') and player1.match_task:
            player1.match_task.cancel()
        if hasattr(player2, 'match_task') and player2.match_task:
            player2.match_task.cancel()

        # Notify players immediately
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

        # Clean up from invited_games
        if match_id in self.invited_games:
            print(f"Removing invitation {match_id} from invited_games")
            del self.invited_games[match_id]

        # Start the game loop
        try:
            print(f"Starting game loop for match {match_id}")
            asyncio.create_task(player1.run_game_loop(match_id))
        except Exception as e:
            print(f"Error starting game loop: {e}")

        return match_id

    async def add_player_to_queue(self, player):
        """
        Add a player to the matchmaking queue.
        
        Args:
            player: Player consumer instance to add to the queue
        """
        # Check if player is already in queue
        for existing_player, _, _ in self.waiting_players:
            if existing_player == player:
                print(f"Player {player.user.username} is already in queue")
                return
        
        print(f"Adding {player.user.username} to matchmaking queue")
        
        # Store numeric timestamp for time calculations
        current_time = asyncio.get_event_loop().time()
        
        # Add player with current timestamp and ELO rating
        # This allows for ELO-based matchmaking
        self.waiting_players.append((
            player, 
            current_time,  # Use numeric timestamp instead of string
            player.user.elo if hasattr(player.user, 'elo') else 1000
        ))
        
        # Let the player know they've been added to queue
        await player.send(text_data=json.dumps({
            "type": "waiting",
            "message": "En attente d'un adversaire...",
            "queue_position": len(self.waiting_players)
        }))
        
        # Try to find a match immediately
        await self.find_match_for_player(player)

    async def find_match_for_player(self, player):
        """
        Find a suitable match for a player based on ELO rating.
        
        Args:
            player: Player object to match
            
        Returns:
            bool: True if a match was found and created
        """
        if not self.waiting_players:
            return False
        
        my_elo = player.user.elo
        best_match = None
        min_elo_diff = float('inf')
        
        for i, (waiting_player, timestamp, elo) in enumerate(self.waiting_players):
            if waiting_player == player:
                continue
                
            elo_diff = abs(my_elo - elo)
            
            wait_time = asyncio.get_event_loop().time() - timestamp
            adjusted_diff = elo_diff / (1 + 0.1 * wait_time)  # Reduce difference based on wait time
            
            if adjusted_diff < min_elo_diff:
                min_elo_diff = adjusted_diff
                best_match = (i, waiting_player)
        
        # Match if ELO difference is acceptable or player has waited long enough
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
        
        Returns:
            int: Number of matches created
        """
        if len(self.waiting_players) < 2:
            return 0
            
        matches_created = 0
        players_to_remove = []
        
        # Start from the player who has waited the longest
        for i, (player, timestamp, _) in enumerate(self.waiting_players):
            if i in players_to_remove:
                continue
                
            # Find best match for this player
            best_match = None
            min_elo_diff = float('inf')
            
            for j, (other_player, other_timestamp, other_elo) in enumerate(self.waiting_players):
                if i == j or j in players_to_remove:
                    continue
                    
                elo_diff = abs(player.user.elo - other_elo)
                wait_time = asyncio.get_event_loop().time() - other_timestamp
                adjusted_diff = elo_diff / (1 + 0.1 * wait_time)
                
                if adjusted_diff < min_elo_diff:
                    min_elo_diff = adjusted_diff
                    best_match = (j, other_player)
            
            # If found a suitable match
            if best_match and (min_elo_diff < 18 or asyncio.get_event_loop().time() - timestamp > 30):
                matched_idx, matched_player = best_match
                
                # Create game
                await self.create_match(player, matched_player)
                
                # Mark these players for removal from the queue
                players_to_remove.extend([i, matched_idx])
                matches_created += 1
        
        # Remove matched players from queue (in reverse order to maintain indices)
        for idx in sorted(players_to_remove, reverse=True):
            if idx < len(self.waiting_players):
                del self.waiting_players[idx]
                
        return matches_created
    
    async def create_match(self, player1, player2):
        """
        Create a match between two players.
        
        Args:
            player1: First player
            player2: Second player
            
        Returns:
            str: Match ID of the created match
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
        
        # Start the game loop - THIS WAS MISSING
        asyncio.create_task(player1.run_game_loop(match_id))
        
        return match_id
    
    async def remove_player(self, player):
        """
        Remove a player from the waiting queue.
        
        Args:
            player: Player to remove
            
        Returns:
            bool: True if the player was removed
        """
        async with self.matchmaking_lock:
            # Check if player is in the waiting queue
            original_length = len(self.waiting_players)
            self.waiting_players = [(p, ts, elo) for p, ts, elo in self.waiting_players if p != player]
            
            # If player was in a match, handle forfeit
            for match_id, match_data in list(self.active_matches.items()):
                if player in match_data["players"]:
                    # Find the opponent
                    opponent = next((p for p in match_data["players"] if p != player), None)
                    if opponent:
                        # Notify opponent of win by forfeit
                        await opponent.send(text_data=json.dumps({
                            "type": "game_over",
                            "winner": opponent.user.username,
                            "message": f"Victoire par abandon ! {player.user.username} a quitté la partie."
                        }))
                        
                        # Update ELO ratings for forfeit
                        await self.update_elo_for_forfeit(opponent.user, player.user)
                    
                    # Remove the match
                    del self.active_matches[match_id]
            
            return original_length > len(self.waiting_players)
    
    @database_sync_to_async
    def update_elo_for_forfeit(self, winner, loser, forfeit_penalty=5):
        """
        Updates ELO ratings when a player forfeits.
        
        Args:
            winner: User who stays in the game
            loser: User who forfeited
            forfeit_penalty: Additional ELO penalty for forfeiting
        """
        winner_elo, loser_elo = calculate_elo_change(winner.elo, loser.elo)
        
        # Apply additional forfeit penalty
        loser_elo -= forfeit_penalty
        
        # Update user records
        winner.elo = winner_elo
        loser.elo = loser_elo
        winner.wins += 1
        loser.losses += 1
        
        # Record match in history
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
        
        # Save changes
        winner.save()
        loser.save()