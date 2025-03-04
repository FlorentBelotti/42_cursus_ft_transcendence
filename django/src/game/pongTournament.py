import asyncio
import json
import math
import random
from datetime import datetime
from channels.db import database_sync_to_async
from .pongHelper import get_display_name, now_str, create_initial_game_state
from .pongEngine import GameEngine

class TournamentManager:
    def __init__(self):
        """
        Initialize the tournament manager.
        """
        self.tournaments = {}
        self.next_tournament_id = 1
        self.game_engine = GameEngine()
        
    async def create_tournament(self):
        """
        Create a new tournament and return its ID.
        
        Returns:
            int: ID of the newly created tournament
        """
        tournament_id = self.next_tournament_id
        self.next_tournament_id += 1
        
        self.tournaments[tournament_id] = {
            "players": [],
            "semifinal_winners": {},
            "semifinal_losers": {},
            "rankings": {},
            "match_states": {},
            "created_at": now_str()
        }
        
        return tournament_id
    
    async def add_player_to_tournament(self, player, tournament_id=None):
        """
        Add a player to an existing tournament or create a new one.
        
        Args:
            player: Player object to add
            tournament_id: Optional ID of tournament to join
            
        Returns:
            tuple: (tournament_id, player_position)
        """
        # Find an available tournament if none specified
        if tournament_id is None:
            for tid, tournament in self.tournaments.items():
                if len(tournament["players"]) < 4 and "started" not in tournament:
                    tournament_id = tid
                    break
            
            # Create new tournament if none available
            if tournament_id is None:
                tournament_id = await self.create_tournament()
        
        # Add player to tournament
        tournament = self.tournaments[tournament_id]
        player_position = len(tournament["players"]) + 1
        tournament["players"].append(player)
        
        # Store player info
        player.tournament_id = tournament_id
        player.player_position = player_position
        
        # Check if tournament can start
        if len(tournament["players"]) == 4:
            tournament["ready_to_start"] = True
        
        return tournament_id, player_position
    
    async def get_tournament_state(self, tournament_id):
        """
        Get the current state of a tournament.
        
        Args:
            tournament_id: ID of the tournament
            
        Returns:
            dict: Tournament state
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        
        players_info = []
        for i, player in enumerate(players):
            players_info.append({
                "username": player.user.username,
                "nickname": player.user.nickname if hasattr(player.user, 'nickname') and player.user.nickname else None,
                "elo": player.user.elo,
                "position": i + 1
            })
            
        return {
            "type": "tournament_state",
            "tournament_id": tournament_id,
            "player_count": len(players),
            "players": players_info,
            "waiting": True,
            "message": f"En attente de joueurs ({len(players_info)}/4)..."
        }

    async def start_tournament(self, tournament_id):
        """
        Start a tournament when enough players have joined.
        
        Args:
            tournament_id: ID of the tournament to start
            
        Returns:
            bool: True if tournament started successfully
        """
        tournament = self.tournaments[tournament_id]
        
        if len(tournament["players"]) != 4:
            return False
            
        tournament["started"] = True
        
        # Set up the two semi-final matches
        await self.setup_semifinals(tournament_id)
        return True
    
    async def setup_semifinals(self, tournament_id):
        """
        Set up the semifinal matches for a tournament.
        
        Args:
            tournament_id: ID of the tournament
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        
        # Match 1: Player 1 vs Player 2
        # Match 2: Player 3 vs Player 4
        match1_players = players[0:2]
        match2_players = players[2:4]
        
        # Create semifinal matches
        await self.create_match(match1_players, "semifinal1", tournament_id)
        await self.create_match(match2_players, "semifinal2", tournament_id)
    
    async def create_match(self, players, match_id, tournament_id):
        """
        Create a match between two players in the tournament.
        
        Args:
            players: List of two player objects
            match_id: ID for the match (e.g., 'semifinal1')
            tournament_id: ID of the tournament
        """
        player1, player2 = players
        
        # Create initial game state
        game_state = create_initial_game_state(player1, player2, match_id, tournament_id)
        
        # Store match state
        tournament = self.tournaments[tournament_id]
        tournament["match_states"][match_id] = game_state
        
        # Set player match info
        for i, player in enumerate(players):
            player.match_id = match_id
            player.player_number = i + 1
        
        # Notify players
        for i, player in enumerate(players):
            await player.send(text_data=json.dumps({
                "type": "match_created",
                "match_id": match_id,
                "player_number": player.player_number,
                "opponent": players[1-i].user.username,
                "game_state": game_state
            }))
        
        # Start the game loop
        asyncio.create_task(self.run_match(match_id, tournament_id, players))
    
    async def run_match(self, match_id, tournament_id, players):
        """
        Run a match between two players.
        
        Args:
            match_id: ID of the match
            tournament_id: ID of the tournament
            players: List of two player objects
        """
        tournament = self.tournaments[tournament_id]
        game_state = tournament["match_states"][match_id]
        
        while True:
            # Sleep to control game speed
            await asyncio.sleep(0.02)  # 50 FPS
            
            # Check if players are still connected
            if not all(hasattr(player, 'match_id') and player.match_id == match_id for player in players):
                # Handle player disconnect
                disconnected_player = next((p for p in players if not hasattr(p, 'match_id') or p.match_id != match_id), None)
                if disconnected_player:
                    connected_player = next((p for p in players if p != disconnected_player), None)
                    if connected_player:
                        await self.handle_match_result(match_id, tournament_id, connected_player.user.username, forfeit=True)
                break
            
            # Update game state
            self.game_engine.update_game_state(game_state)
            
            # Check for goals
            game_over, winner_username = await self.game_engine.check_goals(game_state)
            
            if game_over:
                await self.handle_match_result(match_id, tournament_id, winner_username)
                break
            
            # Send updated state to players
            for player in players:
                try:
                    await player.send(text_data=json.dumps({
                        "type": "game_update",
                        "game_state": game_state
                    }))
                except Exception:
                    pass
    
    async def handle_match_result(self, match_id, tournament_id, winner_username, forfeit=False):
        """
        Handle the result of a match.
        
        Args:
            match_id: ID of the completed match
            tournament_id: ID of the tournament
            winner_username: Username of the winner
            forfeit: Whether the match ended due to forfeit
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        
        # Find winner and loser
        winner = next((player for player in players if player.user.username == winner_username), None)
        if not winner:
            return
            
        loser = next((player for player in players 
                    if hasattr(player, 'match_id') and player.match_id == match_id 
                    and player.user.username != winner_username), None)
        
        # Get display names
        winner_display = get_display_name(winner.user)
        
        # Store result in tournament data
        if match_id.startswith("semifinal"):
            tournament["semifinal_winners"][match_id] = winner
            if loser:
                tournament["semifinal_losers"][match_id] = loser
                
        # Notify participants and spectators
        result_message = {
            "type": "match_result",
            "match_id": match_id,
            "winner": winner_username,
            "winner_display": winner_display,
            "message": f"{winner_display} a remporté le match!" if not forfeit else f"{winner_display} gagne par forfait!"
        }
        
        # Send to match participants and spectators
        for player in players:
            if player in [winner, loser] or not hasattr(player, 'match_id') or not player.match_id:
                try:
                    await player.send(text_data=json.dumps(result_message))
                except Exception:
                    pass
        
        # Clear match IDs
        for player in [winner, loser]:
            if player:
                player.match_id = None
                player.player_number = None
        
        # Check tournament progress
        await self.check_tournament_progress(tournament_id)
    
    async def check_tournament_progress(self, tournament_id):
        """
        Check tournament progress and advance to next stage if ready.
        
        Args:
            tournament_id: ID of the tournament
        """
        tournament = self.tournaments[tournament_id]
        
        # Check if both semifinals are complete
        if (len(tournament["semifinal_winners"]) == 2 and 
            "semifinal1" in tournament["semifinal_winners"] and
            "semifinal2" in tournament["semifinal_winners"]):
            
            # Check if all players are not in matches
            players = tournament["players"]
            if not any(hasattr(p, 'match_id') and p.match_id for p in players):
                # Set up third-place match and finals
                await self.setup_third_place_match(tournament_id)
                await self.setup_finals(tournament_id)
    
    async def setup_third_place_match(self, tournament_id):
        """
        Set up the third-place match.
        
        Args:
            tournament_id: ID of the tournament
        """
        tournament = self.tournaments[tournament_id]
        loser1 = tournament["semifinal_losers"]["semifinal1"]
        loser2 = tournament["semifinal_losers"]["semifinal2"]
        
        # Get display names
        loser1_display = get_display_name(loser1.user)
        loser2_display = get_display_name(loser2.user)
        
        # Notify all players
        players = tournament["players"]
        for player in players:
            await player.send(text_data=json.dumps({
                "type": "third_place_starting",
                "message": f"Match pour la 3ème place: {loser1_display} vs {loser2_display}",
                "contestants": {
                    "player1": loser1.user.username,
                    "player1_display": loser1_display,
                    "player2": loser2.user.username,
                    "player2_display": loser2_display
                }
            }))
        
        # Add small delay for UI transition
        await asyncio.sleep(3)
        
        # Create the match
        await self.create_match([loser1, loser2], "third_place", tournament_id)
    
    async def setup_finals(self, tournament_id):
        """
        Set up the finals match.
        
        Args:
            tournament_id: ID of the tournament
        """
        tournament = self.tournaments[tournament_id]
        winner1 = tournament["semifinal_winners"]["semifinal1"]
        winner2 = tournament["semifinal_winners"]["semifinal2"]
        
        # Get display names
        winner1_display = get_display_name(winner1.user)
        winner2_display = get_display_name(winner2.user)
        
        # Notify all players
        players = tournament["players"]
        for player in players:
            await player.send(text_data=json.dumps({
                "type": "finals_starting",
                "message": f"Finale: {winner1_display} vs {winner2_display}",
                "finalists": {
                    "player1": winner1.user.username,
                    "player1_display": winner1_display,
                    "player2": winner2.user.username,
                    "player2_display": winner2_display
                }
            }))
        
        # Add small delay for UI transition
        await asyncio.sleep(3)
        
        # Create the match
        await self.create_match([winner1, winner2], "final", tournament_id)
    
    async def handle_tournament_winner(self, tournament_id, winner_username):
        """
        Handle the tournament champion.
        
        Args:
            tournament_id: ID of the tournament
            winner_username: Username of the tournament winner
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        
        # Find winner and runner-up
        winner = next((player for player in players if player.user.username == winner_username), None)
        if not winner:
            return
            
        finalist1 = tournament["semifinal_winners"]["semifinal1"]
        finalist2 = tournament["semifinal_winners"]["semifinal2"]
        runner_up = finalist2 if finalist1.user.username == winner_username else finalist1
        
        # Update rankings
        tournament["rankings"][1] = winner.user.username
        tournament["rankings"][2] = runner_up.user.username
        
        # Broadcast rankings
        await self.broadcast_tournament_rankings(tournament_id)
        
        # Check if third-place match is also complete
        if 3 in tournament["rankings"]:
            await self.update_all_elo_ratings(tournament_id)
            await self.cleanup_tournament(tournament_id)
    
    async def handle_third_place_winner(self, tournament_id, winner_username):
        """
        Handle the third-place winner.
        
        Args:
            tournament_id: ID of the tournament
            winner_username: Username of the third-place winner
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        
        # Find third-place winner and loser
        winner = next((player for player in players if player.user.username == winner_username), None)
        if not winner:
            return
            
        # Find the loser (fourth place)
        loser = next((player for player in players 
                    if player in [tournament["semifinal_losers"].get("semifinal1"),
                                 tournament["semifinal_losers"].get("semifinal2")]
                    and player.user.username != winner_username), None)
        
        # Update rankings
        tournament["rankings"][3] = winner_username
        if loser:
            tournament["rankings"][4] = loser.user.username
        
        # Broadcast rankings
        await self.broadcast_tournament_rankings(tournament_id)
        
        # Check if finals are also complete
        if 1 in tournament["rankings"]:
            await self.update_all_elo_ratings(tournament_id)
            await self.cleanup_tournament(tournament_id)
    
    async def broadcast_tournament_rankings(self, tournament_id):
        """
        Send current tournament rankings to all players.
        
        Args:
            tournament_id: ID of the tournament
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        rankings = tournament["rankings"]
        
        # Convert rankings to list for the client
        ranking_list = []
        for position in range(1, 5):
            if position in rankings:
                username = rankings[position]
                player = next((p for p in players if p.user.username == username), None)
                
                nickname = None
                if player and hasattr(player.user, 'nickname') and player.user.nickname:
                    nickname = player.user.nickname
                    
                ranking_list.append({
                    "position": position,
                    "username": username,
                    "nickname": nickname,
                    "medal": "🥇" if position == 1 else "🥈" if position == 2 else "🥉" if position == 3 else ""
                })
        
        # Send to all players
        for player in players:
            try:
                await player.send(text_data=json.dumps({
                    "type": "tournament_rankings",
                    "rankings": ranking_list,
                    "complete": len(rankings) >= 4,
                    "message": "Classement du tournoi"
                }))
            except Exception:
                pass
    
    @database_sync_to_async
    def update_elo_ratings_db(self, champion, runner_up, third_place, fourth_place):
        """
        Update ELO ratings in database for all tournament participants.
        
        Args:
            champion: Tournament champion player object
            runner_up: Tournament runner-up player object
            third_place: Third-place player object
            fourth_place: Fourth-place player object
        """
        K = 32  # Standard K-factor
        now = now_str()
        
        # Champion gets a big boost
        champion.user.elo += int(K * 0.7) + 15
        champion.user.wins += 2
        
        # Runner-up gets a small boost
        runner_up.user.elo += int(K * 0.3) + 5
        runner_up.user.wins += 1
        runner_up.user.losses += 1
        
        # Third place gets neutral adjustment
        third_place.user.elo += int(K * 0.1)
        third_place.user.wins += 1
        third_place.user.losses += 1
        
        # Fourth place gets small penalty
        if fourth_place:
            fourth_place.user.elo -= int(K * 0.1)
            fourth_place.user.losses += 2
        
        # Record tournament match history - Final
        champion.user.history.append({
            'opponent_id': runner_up.user.id,
            'opponent_username': runner_up.user.username,
            'result': 'win',
            'timestamp': now,
            'match_type': 'tournament_final'
        })
        
        runner_up.user.history.append({
            'opponent_id': champion.user.id,
            'opponent_username': champion.user.username,
            'result': 'loss',
            'timestamp': now,
            'match_type': 'tournament_final'
        })
        
        # Record third-place match
        if third_place and fourth_place:
            third_place.user.history.append({
                'opponent_id': fourth_place.user.id,
                'opponent_username': fourth_place.user.username,
                'result': 'win',
                'timestamp': now,
                'match_type': 'tournament_third_place'
            })
            
            fourth_place.user.history.append({
                'opponent_id': third_place.user.id,
                'opponent_username': third_place.user.username,
                'result': 'loss',
                'timestamp': now,
                'match_type': 'tournament_third_place'
            })
        
        # Save changes
        champion.user.save()
        runner_up.user.save()
        third_place.user.save()
        if fourth_place:
            fourth_place.user.save()
        
    async def update_all_elo_ratings(self, tournament_id):
        """
        Update ELO for all participants when tournament is complete.
        
        Args:
            tournament_id: ID of the tournament
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        rankings = tournament["rankings"]
        
        if len(rankings) < 3:
            return
            
        # Find players by username
        champion = next((p for p in players if p.user.username == rankings.get(1)), None)
        runner_up = next((p for p in players if p.user.username == rankings.get(2)), None)
        third_place = next((p for p in players if p.user.username == rankings.get(3)), None)
        fourth_place = next((p for p in players if p.user.username == rankings.get(4, "")), None)
        
        if not (champion and runner_up and third_place):
            return
        
        # Update database
        await self.update_elo_ratings_db(champion, runner_up, third_place, fourth_place)
    
    async def cleanup_tournament(self, tournament_id):
        """
        Clean up tournament resources when it's complete.
        
        Args:
            tournament_id: ID of the tournament to clean up
        """
        tournament = self.tournaments[tournament_id]
        
        # Keep rankings for a while, but mark as completed
        tournament["completed"] = True
        tournament["completed_at"] = now_str()
        
        # Clear unnecessary data
        if "match_states" in tournament:
            tournament["match_states"] = {}
    
    async def handle_player_disconnect(self, player):
        """
        Handle player disconnection from tournament.
        
        Args:
            player: Player object that disconnected
            
        Returns:
            bool: True if player was in a tournament
        """
        if not hasattr(player, 'tournament_id') or player.tournament_id is None:
            return False
            
        tournament_id = player.tournament_id
        if tournament_id not in self.tournaments:
            return False
            
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        
        if player not in players:
            return False
            
        # Check if player is in an active match
        if hasattr(player, 'match_id') and player.match_id:
            match_id = player.match_id
            
            # Find opponent
            opponent = next((p for p in players 
                           if hasattr(p, 'match_id') and p.match_id == match_id 
                           and p != player), None)
            
            # Handle match result - opponent wins by forfeit
            if opponent:
                await self.handle_match_result(match_id, tournament_id, opponent.user.username, forfeit=True)
        
        # Remove player from tournament
        tournament["players"] = [p for p in players if p != player]
        
        # If tournament hasn't started yet, notify remaining players
        if "started" not in tournament and len(tournament["players"]) > 0:
            for p in tournament["players"]:
                try:
                    state = await self.get_tournament_state(tournament_id)
                    state["your_position"] = p.player_position
                    await p.send(text_data=json.dumps(state))
                except Exception:
                    pass
        
        return True
    
    async def handle_player_input(self, player, input_value):
        """
        Handle player input for paddle movement.
        
        Args:
            player: Player object sending input
            input_value: Input value for paddle movement (-1, 0, 1)
            
        Returns:
            bool: True if input was processed
        """
        if not hasattr(player, 'tournament_id') or player.tournament_id is None:
            return False
            
        if not hasattr(player, 'match_id') or player.match_id is None:
            return False
            
        tournament_id = player.tournament_id
        match_id = player.match_id
        
        if tournament_id not in self.tournaments:
            return False
            
        tournament = self.tournaments[tournament_id]
        
        if match_id not in tournament.get("match_states", {}):
            return False
            
        # Update input in game state
        game_state = tournament["match_states"][match_id]
        player_key = f"player{player.player_number}"
        game_state["inputs"][player_key] = input_value
        
        return True