import asyncio
import json
import math
import random
from datetime import datetime
from channels.db import database_sync_to_async
from .pongHelper import get_display_name, now_str, create_initial_game_state
from .pongEngine import GameEngine

class TournamentManager:

    """
    ╔═══════════════════════════════════════════════════╗
    ║             TournamentManager                     ║
    ╠═══════════════════════════════════════════════════╣
    ║ Tournament system for Pong competitions           ║
    ║                                                   ║
    ║ • Manages bracketed 4-player tournaments          ║
    ║ • Controls semifinal, final, and 3rd place matches║
    ║ • Tracks rankings and player progression          ║
    ║ • Updates ELO ratings based on final placement    ║
    ╚═══════════════════════════════════════════════════╝
    """

    def __init__(self):
        """
        Initialize the tournament manager.
        """
        self.tournaments = {}
        self.next_tournament_id = 1
        self.game_engine = GameEngine()

    #===========================================================#
    #                TOURNAMENT MANAGEMENT                      #
    #===========================================================#

    async def create_tournament(self):
        """
        Create a new tournament and return its ID.
        """

        tournament_id = self.next_tournament_id
        self.next_tournament_id += 1
        self.tournaments[tournament_id] = {
            "players": [],
            "semifinal_winners": {},
            "semifinal_losers": {},
            "rankings": {},
            "match_states": {},
            "finals_created": False,
            "complete": False,      
            "created_at": now_str()
        }
        return tournament_id
    
    async def add_player_to_tournament(self, player, tournament_id=None):
        """
        Add a player to an existing tournament or create a new one.
        """

        print(f"Tournament Manager: Adding player to tournament, user={getattr(player.user, 'username', 'unknown')}")
        
        # Find an available tournament
        if tournament_id is None:
            for tid, tournament in self.tournaments.items():
                if len(tournament["players"]) < 4 and "started" not in tournament:
                    tournament_id = tid
                    break
            # Create new tournament if none available
            if tournament_id is None:
                print("Creating new tournament")
                tournament_id = await self.create_tournament()
        
        # Add player to tournament
        tournament = self.tournaments[tournament_id]
        player_position = len(tournament["players"]) + 1
        tournament["players"].append(player)
        
        # Store player info
        player.tournament_id = tournament_id
        player.player_position = player_position
        
        print(f"Player added to tournament {tournament_id} at position {player_position}")
        
        # Check if tournament can start
        if len(tournament["players"]) == 4:
            tournament["ready_to_start"] = True
            print(f"Tournament {tournament_id} ready to start - 4 players joined")
        
        return tournament_id, player_position
    
    async def get_tournament_state(self, tournament_id):
        """
        Get the current state of a tournament.
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
        """

        tournament = self.tournaments[tournament_id]
        if len(tournament["players"]) != 4:
            return False
        tournament["started"] = True
        
        # Setup first games
        await self.setup_semifinals(tournament_id)
        return True

    async def check_tournament_progress(self, tournament_id):
        """
        Check tournament progress and advance to next stage if ready.
        """

        tournament = self.tournaments[tournament_id]
    
        # Check for semifinals completions
        if (len(tournament["semifinal_winners"]) == 2 and 
            "semifinal1" in tournament["semifinal_winners"] and
            "semifinal2" in tournament["semifinal_winners"]):
    
            # Check if players are wainting between round
            players = tournament["players"]
            if not any(hasattr(p, 'match_id') and p.match_id for p in players):
                # Skip if finals have already been set up
                if tournament.get("finals_created", False):
                    # Check if tournament is complete
                    if tournament.get("complete", False):
                        print(f"Tournament {tournament_id} is already marked as complete.")
                        # Broadcast rankings
                        await self.broadcast_tournament_rankings(tournament_id)
                        return
    
                    # Check if final and third-place match results are recorded
                    if 1 in tournament.get("rankings", {}) or 3 in tournament.get("rankings", {}):
                        # Define player's ranking from match results
                        all_rankings_present = (1 in tournament.get("rankings", {}) and 
                                               2 in tournament.get("rankings", {}) and
                                               3 in tournament.get("rankings", {}) and 
                                               4 in tournament.get("rankings", {}))
                        # Broadcast ranking
                        if all_rankings_present:
                            print(f"Tournament {tournament_id} completing - all rankings present")
                            tournament["complete"] = True
                            await self.broadcast_tournament_rankings(tournament_id)
                            await self.update_all_elo_ratings(tournament_id)
                    return
    
                # Set up looser final and winner final
                tournament["finals_created"] = True
                await self.setup_third_place_match(tournament_id)
                await self.setup_finals(tournament_id)

    async def handle_tournament_winner(self, tournament_id, winner_username):
        """
        Handle the tournament champion.
        """

        print(f"Handling tournament winner: {winner_username}")
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

        # Broadcast partial rankings (not yet marking as complete)
        await self.broadcast_tournament_rankings(tournament_id)

        # Check if third-place match is also complete
        if 3 in tournament["rankings"]:
            print(f"Tournament {tournament_id}: Both final and third-place matches complete")

            # Give players time to see their match result first
            await asyncio.sleep(2)

            # Now mark as complete and broadcast final rankings
            tournament["complete"] = True  # Explicitly mark as complete
            await self.broadcast_tournament_rankings(tournament_id)
            await self.update_all_elo_ratings(tournament_id)
            await self.cleanup_tournament(tournament_id)
        else:
            print(f"Tournament {tournament_id}: Final match complete, waiting for third-place match")

    
    async def handle_third_place_winner(self, tournament_id, winner_username):
        """
        Handle the third-place winner.
        """
    
        print(f"Handling third place winner: {winner_username}")
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
    
        # Broadcast partial rankings
        await self.broadcast_tournament_rankings(tournament_id)
    
        # Check if finals are also complete
        if 1 in tournament["rankings"]:
            print(f"Tournament {tournament_id}: Both final and third-place matches complete")
            
            # Give players time to see their match result first
            await asyncio.sleep(2)
            
            # Now mark as complete and broadcast final rankings
            tournament["complete"] = True
            await self.broadcast_tournament_rankings(tournament_id)
            await self.update_all_elo_ratings(tournament_id)
            await self.cleanup_tournament(tournament_id)
        else:
            print(f"Tournament {tournament_id}: Third-place match complete, waiting for final match")

    async def broadcast_tournament_rankings(self, tournament_id):
        """
        Send current tournament rankings to all players.
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        rankings = tournament["rankings"]
        is_complete = tournament.get("complete", False)

        print(f"Broadcasting rankings for tournament {tournament_id}")
        print(f"Current rankings: {rankings}")
        print(f"Tournament complete: {is_complete}")

        # Convert rankings to list
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

        # Send to all players, but with different logic based on tournament state
        for player in players:
            try:
                # Check if player is in an active match
                is_in_match = hasattr(player, 'match_id') and player.match_id

                # ONLY send rankings in these conditions:
                # 1. Tournament is complete - send to everyone 
                # 2. Player is NOT in a match - can see partial rankings
                if is_complete or not is_in_match:
                    await player.send(text_data=json.dumps({
                        "type": "tournament_rankings",
                        "rankings": ranking_list,
                        "complete": is_complete,
                        "message": "Classement final du tournoi" if is_complete else "Classement du tournoi"
                    }))
            except Exception as e:
                print(f"Error sending rankings to player: {str(e)}")

    async def cleanup_tournament(self, tournament_id):
        """
        Clean up tournament resources when it's complete.
        """

        tournament = self.tournaments[tournament_id]
        
        # Keep rankings
        tournament["completed"] = True
        tournament["completed_at"] = now_str()
        
  
        if "match_states" in tournament:
            tournament["match_states"] = {}

    #===========================================================#
    #                MATCH MANAGEMENT                           #
    #===========================================================#

    async def setup_semifinals(self, tournament_id):
        """
        Set up the semifinal matches for a tournament.
        """

        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        
        # Match 1: Player 1 vs Player 2
        # Match 2: Player 3 vs Player 4
        match1_players = players[0:2]
        match2_players = players[2:4]
        await self.create_match(match1_players, "semifinal1", tournament_id)
        await self.create_match(match2_players, "semifinal2", tournament_id)
    
    async def create_match(self, players, match_id, tournament_id):
        """
        Create a match between two players in the tournament.
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
        """

        tournament = self.tournaments[tournament_id]
        game_state = tournament["match_states"][match_id]
        
        while True:
            # Sleep to control game speed
            await asyncio.sleep(0.02)  # 50 FPS
            
            # Check if players are still connected
            if not all(hasattr(player, 'match_id') and player.match_id == match_id for player in players):
                # Handle player disconnection
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
        """

        tournament = self.tournaments[tournament_id]
        players = tournament["players"]

        # Get winner and loser
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

        # Notify players
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
    
    async def setup_third_place_match(self, tournament_id):
        """
        Set up the third-place match.
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
        
        # UI transition
        await asyncio.sleep(3)
        
        # Create  match
        await self.create_match([loser1, loser2], "third_place", tournament_id)
    
    async def setup_finals(self, tournament_id):
        """
        Set up the finals match.
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

    #===========================================================#
    #                ELO MANAGEMENT                             #
    #===========================================================#

    @database_sync_to_async
    def apply_forfeit_penalty(self, user):
        """
        Apply ELO penalty to a player who forfeited the tournament.
        """
        # Standard penalty
        penalty = 15

        # Apply penalty
        user.elo = max(0, user.elo - penalty)  # Ensure ELO doesn't go below 0
        user.losses += 1

        now = now_str()
        user.history.append({
            'opponent_id': "NaN",
            'opponent_username': "NaN",
            'result': 'forfeit',
            'timestamp': now,
            'match_type': 'canceled_tournament',
        })

        # Save changes
        user.save()

        print(f"Applied forfeit penalty to {user.username}: -15 ELO")
        return True

    @database_sync_to_async
    def update_elo_ratings_db(self, champion, runner_up, third_place, fourth_place):
        """
        Update ELO ratings in database for all tournament participants.
        """
        K = 32  # Standard K-factor
        now = now_str()
        
        # Champion
        champion.user.elo += int(K * 0.7) + 15
        champion.user.wins += 2
        
        # Runner-up
        runner_up.user.elo += int(K * 0.3) + 5
        runner_up.user.wins += 1
        runner_up.user.losses += 1
        
        # Third place
        third_place.user.elo += int(K * 0.1)
        third_place.user.wins += 1
        third_place.user.losses += 1
        
        # Looser penalty
        if fourth_place:
            fourth_place.user.elo -= int(K * 0.1)
            fourth_place.user.losses += 2
        
        # History
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
        champion.user.save()
        runner_up.user.save()
        third_place.user.save()
        if fourth_place:
            fourth_place.user.save()
        
    async def update_all_elo_ratings(self, tournament_id):
        """
        Update ELO for all participants when tournament is complete.
        """
        tournament = self.tournaments[tournament_id] 
        
        if tournament.get("cancelled", False):
            print(f"Skipping ELO updates for cancelled tournament {tournament_id}")
            return

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

    #===========================================================#
    #                PLAYER MANAGEMENT                          #
    #===========================================================#

    @database_sync_to_async
    def update_players_history_for_cancelled_tournament(self, tournament_id, forfeiter_username):
        """
        Add a forfeit entry to all players' history when a tournament is cancelled.
        """
        tournament = self.tournaments[tournament_id]
        players = tournament["players"]
        now = now_str()

        print(f"Updating history for {len(players)} players in cancelled tournament {tournament_id}")
        
        # Get already penalized players to avoid duplicate records
        penalized_players = tournament.get("penalized_players", set())

        for player in players:
            # Skip the forfeiter as they already got a penalty entry
            # And skip any other players who might have already been penalized
            if player.user.username == forfeiter_username or player.user.username in penalized_players:
                continue

            # Add forfeit record to player history
            player.user.history.append({
                'opponent_id': "NaN",
                'opponent_username': "NaN",
                'result': 'cancel',
                'timestamp': now,
                'match_type': 'canceled_tournament',
                'forfeiter': forfeiter_username  # Track who caused the cancellation
            })

            # Save the user model
            player.user.save()

        print(f"Successfully updated history for all players in tournament {tournament_id}")
        return True

    async def handle_player_disconnect(self, player):
        """
        Handle player disconnection from tournament.
        Cancel the entire tournament if it has already started.
        Apply ELO penalty to the disconnected player.
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

        # Get forfeiter info for notifications
        forfeiter_username = player.user.username
        forfeiter_display = get_display_name(player.user)

        if tournament.get("started", False) and not tournament.get("complete", False):
            # Check if tournament is already cancelled to avoid duplicate processing
            if tournament.get("cancelled", False):
                print(f"Tournament {tournament_id} is already cancelled, skipping duplicate cancellation.")
                return True

            print(f"Player {forfeiter_username} disconnected from active tournament {tournament_id}. Cancelling tournament.")
            
            # Mark tournament as cancelled FIRST to prevent duplicate processing
            tournament["cancelled"] = True
            tournament["cancelled_by"] = forfeiter_username
            tournament["cancelled_at"] = now_str()
            
            # Track players who received penalties to avoid duplicates
            if "penalized_players" not in tournament:
                tournament["penalized_players"] = set()
                
            # Only apply ELO penalty if not already penalized
            if forfeiter_username not in tournament.get("penalized_players", set()):
                # Apply ELO penalty to forfeiting player
                await self.apply_forfeit_penalty(player.user)
                tournament["penalized_players"].add(forfeiter_username)
                
            # Only update history ONCE per tournament
            if not tournament.get("history_updated", False):
                await self.update_players_history_for_cancelled_tournament(tournament_id, forfeiter_username)
                tournament["history_updated"] = True

            # IMPORTANT: Cancel any ongoing match tasks first
            active_match_ids = []
            for match_id in list(tournament.get("match_states", {}).keys()):
                active_match_ids.append(match_id)
                
            # Clear match states immediately to stop game logic updates
            if "match_states" in tournament:
                tournament["match_states"] = {}
            
            # Reset all players' match info to prevent further updates
            for p in players:
                p.match_id = None
                p.player_number = None
            
            # Track players who have already been notified
            if "notified_players" not in tournament:
                tournament["notified_players"] = set()
                
            # Notify all players about cancellation
            for p in players:
                if p != player and p.user.username not in tournament.get("notified_players", set()):
                    try:
                        print(f"Sending cancellation notice to {p.user.username}")
                        await p.send(text_data=json.dumps({
                            "type": "tournament_cancelled",
                            "message": "Tournament cancelled due to player forfeit",
                            "forfeiter": forfeiter_username,
                            "forfeiter_display": forfeiter_display,
                            "active_match_ids": active_match_ids  # Include this so frontend knows which matches to ignore
                        }))
                        tournament["notified_players"].add(p.user.username)
                    except Exception as e:
                        print(f"Error notifying player of cancellation: {e}")
            
            # Keep the tournament record but mark as inactive
            tournament["active"] = False
            
            return True
        else:
            print(f"Player {forfeiter_username} disconnected from waiting tournament {tournament_id}.")
            if not tournament.get("started", False):
                tournament["players"] = [p for p in players if p != player]

                # Notify remaining players
                if len(tournament["players"]) > 0:
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
            
        game_state = tournament["match_states"][match_id]
        player_key = f"player{player.player_number}"
        game_state["inputs"][player_key] = input_value
        
        return True