from __future__ import division
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.decorators import login_required
import json
import asyncio
import math
from random import random
from channels.db import database_sync_to_async

canvas_width = 800
canvas_height = 550
pad_width = 20
pad_height = 90
pad_speed = 7
ball_radius = 7
ball_speed = 3

from channels.generic.websocket import AsyncWebsocketConsumer
import json
import asyncio
from channels.db import database_sync_to_async

class TournamentConsumer(AsyncWebsocketConsumer):
    # Class variables to track all tournaments
    tournaments = {}  # tournament_id -> list of players
    next_tournament_id = 1
    tournament_rankings = {}
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.tournament_id = None
        self.player_position = None  # Position in the tournament (1-4)
    
    async def connect(self):
        self.user = self.scope["user"]
        
        if not self.user.is_authenticated:
            await self.close()
            return
            
        await self.accept()
        
        # Join or create a tournament
        await self.join_tournament()
    
    async def join_tournament(self):
        # Find an available tournament or create a new one
        available_tournament = None
        for tournament_id, players in TournamentConsumer.tournaments.items():
            if len(players) < 4:  # Tournament not full
                available_tournament = tournament_id
                break
        
        # If no available tournament, create a new one
        if not available_tournament:
            available_tournament = TournamentConsumer.next_tournament_id
            TournamentConsumer.tournaments[available_tournament] = []
            TournamentConsumer.next_tournament_id += 1
        
        # Add player to tournament
        self.tournament_id = available_tournament
        self.player_position = len(TournamentConsumer.tournaments[available_tournament]) + 1
        TournamentConsumer.tournaments[available_tournament].append(self)
        
        # Send initial state to the new player
        await self.send_tournament_state()
        
        # Notify all players in the tournament about the new player
        await self.broadcast_tournament_state()
    
    async def send_tournament_state(self):
        players_info = []
        for i, player in enumerate(TournamentConsumer.tournaments[self.tournament_id]):
            players_info.append({
                "username": player.user.username,
                "elo": player.user.elo,
                "position": i + 1
            })
            
        await self.send(text_data=json.dumps({
            "type": "tournament_state",
            "tournament_id": self.tournament_id,
            "player_count": len(TournamentConsumer.tournaments[self.tournament_id]),
            "your_position": self.player_position,
            "players": players_info,
            "waiting": True,
            "message": f"En attente de joueurs ({len(players_info)}/4)..."
        }))
    
    async def broadcast_tournament_state(self):
        tournament_players = TournamentConsumer.tournaments[self.tournament_id]
        players_info = []
        
        for i, player in enumerate(tournament_players):
            players_info.append({
                "username": player.user.username,
                "elo": player.user.elo,
                "position": i + 1
            })
        
        message = {
            "type": "tournament_state",
            "tournament_id": self.tournament_id,
            "player_count": len(tournament_players),
            "players": players_info,
            "waiting": True,
            "message": f"En attente de joueurs ({len(players_info)}/4)..."
        }
        
        for player in tournament_players:
            message_copy = message.copy()
            message_copy["your_position"] = player.player_position
            await player.send(text_data=json.dumps(message_copy))
            
        # Check if we have enough players to start
        if len(tournament_players) == 4:
            await self.start_tournament()

    async def start_tournament(self):
        tournament_players = TournamentConsumer.tournaments[self.tournament_id]
        
        # Send tournament start notification to all players
        for player in tournament_players:
            await player.send(text_data=json.dumps({
                "type": "tournament_starting",
                "message": "Le tournoi commence! Préparation des demi-finales..."
            }))
        
        # Set up the two semi-final matches
        await self.setup_semifinals()

    async def setup_semifinals(self):
        tournament_players = TournamentConsumer.tournaments[self.tournament_id]
        
        # Match 1: Player 1 vs Player 2
        # Match 2: Player 3 vs Player 4
        match1_players = tournament_players[0:2]
        match2_players = tournament_players[2:4]
        
        # Create semifinal matches
        await self.create_match(match1_players, "semifinal1")
        await self.create_match(match2_players, "semifinal2")

    async def create_match(self, players, match_id):
        # Similar to PongConsumer's create_game but for tournament matches
        player1, player2 = players
        
        # Set up game state for this match
        game_state = {
            "ball": {"x": canvas_width / 2 - ball_radius / 2, "y": canvas_height / 2 - ball_radius / 2},
            "pads": {
                "player1": {"x": 10, "y": (canvas_height - pad_height) / 2},
                "player2": {"x": canvas_width - pad_width - 10, "y": (canvas_height - pad_height) / 2},
            },
            "score": {"player1": 0, "player2": 0},
            "directionBall": {"x": 1 if random() < 0.5 else -1, "y": 1 if random() < 0.5 else -1},
            "ballTouched": False,
            "count": 0,
            "inputs": {"player1": 0, "player2": 0},
            "match_id": match_id,
            "tournament_id": self.tournament_id,
            "player_info": {
                "player1": {"username": player1.user.username, "elo": player1.user.elo},
                "player2": {"username": player2.user.username, "elo": player2.user.elo}
            }
        }
        
        # Store the match state somewhere accessible
        if not hasattr(TournamentConsumer, 'match_states'):
            TournamentConsumer.match_states = {}
        TournamentConsumer.match_states[match_id] = game_state
        
        # Notify players about their match
        for i, player in enumerate(players):
            player.match_id = match_id
            player.player_number = i + 1
            await player.send(text_data=json.dumps({
                "type": "match_created",
                "match_id": match_id,
                "player_number": player.player_number,
                "opponent": players[1-i].user.username,
                "game_state": game_state
            }))
        
        # Start the game loop for this match
        asyncio.create_task(self.update_match_state(match_id, players))
    
    async def update_match_state(self, match_id, players):
        """Game loop for a tournament match"""
        game_state = TournamentConsumer.match_states[match_id]

        # Game loop runs until someone wins or all players disconnect
        while True:
            # Sleep to control game speed
            await asyncio.sleep(0.02)  # 50 FPS

            # Check if players are still connected
            if not all(hasattr(player, 'match_id') and player.match_id == match_id for player in players):
                # Handle disconnection - the player who stayed gets the win
                for player in players:
                    if hasattr(player, 'match_id') and player.match_id == match_id:
                        await self.handle_match_result(match_id, player.user.username)
                        return
                # If no players left, just end the match
                return

            # Update pad positions based on inputs
            for i, player_key in enumerate(["player1", "player2"]):
                player_input = game_state["inputs"].get(player_key, 0)

                # Move the pad
                if player_input < 0:  # Up
                    game_state["pads"][player_key]["y"] = max(0, game_state["pads"][player_key]["y"] - pad_speed)
                elif player_input > 0:  # Down
                    game_state["pads"][player_key]["y"] = min(canvas_height - pad_height, game_state["pads"][player_key]["y"] + pad_speed)

            # Update ball position
            ball_x = game_state["ball"]["x"] + game_state["directionBall"]["x"] * ball_speed
            ball_y = game_state["ball"]["y"] + game_state["directionBall"]["y"] * ball_speed

            # Ball collision with walls (top/bottom)
            if ball_y <= 0 or ball_y >= canvas_height - ball_radius:
                game_state["directionBall"]["y"] *= -1
                ball_y = max(0, min(ball_y, canvas_height - ball_radius))

            # Ball collision with pads
            # Left pad (player1)
            if (ball_x <= game_state["pads"]["player1"]["x"] + pad_width and
                ball_x >= game_state["pads"]["player1"]["x"] and
                ball_y >= game_state["pads"]["player1"]["y"] - ball_radius and
                ball_y <= game_state["pads"]["player1"]["y"] + pad_height):
                game_state["directionBall"]["x"] *= -1
                ball_x = game_state["pads"]["player1"]["x"] + pad_width + 1

            # Right pad (player2)
            if (ball_x + ball_radius >= game_state["pads"]["player2"]["x"] and
                ball_x + ball_radius <= game_state["pads"]["player2"]["x"] + pad_width and
                ball_y >= game_state["pads"]["player2"]["y"] - ball_radius and
                ball_y <= game_state["pads"]["player2"]["y"] + pad_height):
                game_state["directionBall"]["x"] *= -1
                ball_x = game_state["pads"]["player2"]["x"] - ball_radius - 1

            # Update ball position
            game_state["ball"]["x"] = ball_x
            game_state["ball"]["y"] = ball_y

            # Check for goals
            if ball_x <= 0:  # Player 2 scores
                game_state["score"]["player2"] += 1
                await self.reset_ball(game_state)
            elif ball_x >= canvas_width - ball_radius:  # Player 1 scores
                game_state["score"]["player1"] += 1
                await self.reset_ball(game_state)

            # Check for match winner (first to 3 points)
            if game_state["score"]["player1"] >= 3:
                # Pass match_id and tournament_id explicitly
                tournament_id = game_state["tournament_id"]
                await self.handle_match_result(match_id, tournament_id, game_state["player_info"]["player1"]["username"])
                return
            elif game_state["score"]["player2"] >= 3:
                tournament_id = game_state["tournament_id"]
                await self.handle_match_result(match_id, tournament_id, game_state["player_info"]["player2"]["username"])
                return

            # Send updated state to all players
            for player in players:
                if not player.match_id == match_id:
                    continue
                await player.send(text_data=json.dumps({
                    "type": "match_update",
                    "game_state": game_state
                }))

    async def reset_ball(self, game_state):
        """Reset the ball after a goal"""
        game_state["ball"]["x"] = canvas_width / 2 - ball_radius / 2
        game_state["ball"]["y"] = canvas_height / 2 - ball_radius / 2
        game_state["directionBall"]["x"] = 1 if random() < 0.5 else -1
        game_state["directionBall"]["y"] = 1 if random() < 0.5 else -1

    async def handle_match_result(self, match_id, tournament_id, winner_username):
        """Handle the result of a match"""
        # Store winners for finals
        if not hasattr(TournamentConsumer, 'semifinal_winners'):
            TournamentConsumer.semifinal_winners = {}

        if not hasattr(TournamentConsumer, 'semifinal_losers'):
            TournamentConsumer.semifinal_losers = {}

        # Find the winner object from the tournament players
        tournament_players = TournamentConsumer.tournaments[tournament_id]
        winner = next((player for player in tournament_players if player.user.username == winner_username), None)

        if not winner:
            return

        # Find and store the loser for this match
        loser = next((player for player in tournament_players 
                    if hasattr(player, 'match_id') and player.match_id == match_id 
                    and player.user.username != winner_username), None)

        # Store winner and loser
        TournamentConsumer.semifinal_winners[match_id] = winner
        if match_id.startswith("semifinal") and loser:
            TournamentConsumer.semifinal_losers[match_id] = loser

        # Notify ONLY the participants of this match about the result
        # and spectators (players not in any match)
        match_participants = [winner, loser]
        for player in tournament_players:
            # Send to players in this match or not in any match
            if (player in match_participants or 
                not hasattr(player, 'match_id') or 
                not player.match_id):

                await player.send(text_data=json.dumps({
                    "type": "match_result",
                    "match_id": match_id,
                    "winner": winner_username,
                    "message": f"{winner_username} a remporté le match!"
                }))

        # Clear the match_id for these players
        for player in match_participants:
            if player:
                player.match_id = None

        # Check if both semifinals are complete
        if (len(TournamentConsumer.semifinal_winners) == 2 and 
            "semifinal1" in TournamentConsumer.semifinal_winners and
            "semifinal2" in TournamentConsumer.semifinal_winners):

            # Only start the next phase when all matches are complete
            # Check if all players are not in matches
            if not any(hasattr(p, 'match_id') and p.match_id for p in tournament_players):
                if (len(TournamentConsumer.semifinal_losers) == 2 and
                    "semifinal1" in TournamentConsumer.semifinal_losers and
                    "semifinal2" in TournamentConsumer.semifinal_losers):
                    # Set up the third-place match
                    await self.setup_third_place_match(tournament_id)

                # Set up the final
                await self.setup_finals(tournament_id)

        # For final match
        elif match_id == "final":
            await self.handle_tournament_winner(tournament_id, winner_username)
        # For third-place match
        elif match_id == "third_place":
            await self.handle_third_place_winner(tournament_id, winner_username)

    # Replace handle_third_place_winner and handle_tournament_winner with:
    async def handle_third_place_winner(self, tournament_id, winner_username):
        """Handle the third-place winner"""
        tournament_players = TournamentConsumer.tournaments[tournament_id]

        # Initialize rankings dictionary if needed
        if tournament_id not in TournamentConsumer.tournament_rankings:
            TournamentConsumer.tournament_rankings[tournament_id] = {}

        # Find the winner and loser objects
        winner = next((player for player in tournament_players if player.user.username == winner_username), None)

        if not winner:
            return

        # Find the loser of the third-place match
        loser = None
        for player in tournament_players:
            # If player was in the third-place match but isn't the winner
            if (player.user.username != winner_username and
                player in [TournamentConsumer.semifinal_losers.get("semifinal1"),
                          TournamentConsumer.semifinal_losers.get("semifinal2")]):
                loser = player
                break
            
        # Set rankings
        TournamentConsumer.tournament_rankings[tournament_id][3] = winner.user.username
        if loser:
            TournamentConsumer.tournament_rankings[tournament_id][4] = loser.user.username

        # Update and broadcast rankings to all players
        await self.broadcast_tournament_rankings(tournament_id)

        # Check if finals are complete too
        finals_complete = 1 in TournamentConsumer.tournament_rankings.get(tournament_id, {})
        if finals_complete:
            # If both finals and third-place match are done, clean up
            await self.update_all_elo_ratings(tournament_id)
            self._cleanup_tournament(tournament_id)

    async def setup_third_place_match(self, tournament_id):
        """Set up the third-place match"""
        loser1 = TournamentConsumer.semifinal_losers["semifinal1"]
        loser2 = TournamentConsumer.semifinal_losers["semifinal2"]

        # Notify all players about the third-place match
        tournament_players = TournamentConsumer.tournaments[tournament_id]  # Use passed tournament_id
        for player in tournament_players:
            await player.send(text_data=json.dumps({
                "type": "third_place_starting",
                "message": f"Match pour la 3ème place: {loser1.user.username} vs {loser2.user.username}",
                "contestants": {
                    "player1": loser1.user.username,
                    "player2": loser2.user.username
                }
            }))

        # Create third-place match
        await self.create_match([loser1, loser2], "third_place")

    async def setup_finals(self, tournament_id):
        """Set up the final match"""
        # Get the two winners
        winner1 = TournamentConsumer.semifinal_winners["semifinal1"]
        winner2 = TournamentConsumer.semifinal_winners["semifinal2"]

        # Notify all players in the tournament about the finals
        tournament_players = TournamentConsumer.tournaments[tournament_id]  # Use passed tournament_id
        for player in tournament_players:
            await player.send(text_data=json.dumps({
                "type": "finals_starting",
                "message": f"Finale: {winner1.user.username} vs {winner2.user.username}",
                "finalists": {
                    "player1": winner1.user.username,
                    "player2": winner2.user.username
                }
            }))

        # Create final match
        await self.create_match([winner1, winner2], "final")

    async def handle_tournament_winner(self, tournament_id, winner_username):
        """Handle the tournament champion"""
        tournament_players = TournamentConsumer.tournaments[tournament_id]

        # Initialize rankings dictionary if needed
        if tournament_id not in TournamentConsumer.tournament_rankings:
            TournamentConsumer.tournament_rankings[tournament_id] = {}

        # Find the winner and runner-up
        winner = next((player for player in tournament_players if player.user.username == winner_username), None)

        if not winner:
            return

        # Find the runner-up (the other finalist)
        finalist1 = TournamentConsumer.semifinal_winners["semifinal1"]
        finalist2 = TournamentConsumer.semifinal_winners["semifinal2"]
        runner_up = finalist2 if finalist1.user.username == winner_username else finalist1

        # Set rankings
        TournamentConsumer.tournament_rankings[tournament_id][1] = winner.user.username
        TournamentConsumer.tournament_rankings[tournament_id][2] = runner_up.user.username

        # Update and broadcast rankings to all players
        await self.broadcast_tournament_rankings(tournament_id)

        # Check if third-place match is complete too
        third_place_complete = 3 in TournamentConsumer.tournament_rankings.get(tournament_id, {})
        if third_place_complete:
            # If both finals and third-place match are done, clean up
            await self.update_all_elo_ratings(tournament_id)
            self._cleanup_tournament(tournament_id)

    async def update_all_elo_ratings(self, tournament_id):
        """Update ELO for all participants when tournament is complete"""
        tournament_players = TournamentConsumer.tournaments[tournament_id]
        rankings = TournamentConsumer.tournament_rankings.get(tournament_id, {})
        
        if len(rankings) < 3:  # Need at least top 3 for proper ELO updates
            return
            
        # Find players by username
        champion = next((p for p in tournament_players if p.user.username == rankings.get(1)), None)
        runner_up = next((p for p in tournament_players if p.user.username == rankings.get(2)), None)
        third_place = next((p for p in tournament_players if p.user.username == rankings.get(3)), None)
        fourth_place = next((p for p in tournament_players if p.user.username == rankings.get(4, "")), None)
        
        if not (champion and runner_up and third_place):
            return
        
        # Calculate and update ELO ratings
        await self.update_tournament_elo(champion, runner_up, third_place, fourth_place)

    @database_sync_to_async
    def update_tournament_elo(self, champion, runner_up, third_place, fourth_place=None):
        """Update ELO ratings for all tournament participants"""
        K = 32  # Standard K-factor
        
        # Champion gets a big boost
        champion.user.elo += int(K * 0.7) + 15  # Base points + tournament win bonus
        champion.user.wins += 2  # Increment wins
        
        # Runner-up gets a small boost
        runner_up.user.elo += int(K * 0.3) + 5  # Base points + finals bonus
        runner_up.user.losses += 1  # Increment losses
        runner_up.user.wins += 1  # Increment wins

        # Third place gets neutral adjustment
        third_place.user.elo += int(K * 0.1)  # Small bonus for third place
        runner_up.user.wins += 1  # Increment wins
        runner_up.user.losses += 1  # Increment losses

        # Fourth place gets small penalty
        if fourth_place:
            fourth_place.user.elo -= int(K * 0.2)  # Small penalty
            fourth_place.user.losses += 2  # Increment losses
        
        # Save all changes
        champion.user.save()
        runner_up.user.save()
        third_place.user.save()
        if fourth_place:
            fourth_place.user.save()

    async def receive(self, text_data):
        data = json.loads(text_data)
        
        if data['type'] == 'player_input':
            # Handle player inputs for active matches
            if hasattr(self, 'match_id') and self.match_id:
                match_state = TournamentConsumer.match_states.get(self.match_id)
                if match_state:
                    player_key = f'player{self.player_number}'
                    match_state['inputs'][player_key] = data['input']

    # Add this helper method for cleanup
    def _cleanup_tournament(self, tournament_id):
        """Clean up tournament state"""
        if tournament_id in TournamentConsumer.tournaments:
            del TournamentConsumer.tournaments[tournament_id]

        # Reset semifinal winners/losers
        if hasattr(TournamentConsumer, 'semifinal_winners'):
            TournamentConsumer.semifinal_winners = {}

        if hasattr(TournamentConsumer, 'semifinal_losers'):
            TournamentConsumer.semifinal_losers = {}

        # Clear match states
        if hasattr(TournamentConsumer, 'match_states'):
            TournamentConsumer.match_states = {}

    async def broadcast_tournament_rankings(self, tournament_id):
        """Send current tournament rankings to all players"""
        tournament_players = TournamentConsumer.tournaments[tournament_id]
        rankings = TournamentConsumer.tournament_rankings.get(tournament_id, {})
        
        # Convert to list for easier display
        ranking_list = []
        for position in range(1, 5):
            if position in rankings:
                ranking_list.append({
                    "position": position,
                    "username": rankings[position],
                    "medal": "🥇" if position == 1 else "🥈" if position == 2 else "🥉" if position == 3 else ""
                })
        
        # Send to all players
        for player in tournament_players:
            await player.send(text_data=json.dumps({
                "type": "tournament_rankings",
                "rankings": ranking_list,
                "complete": len(rankings) >= 4,
                "message": "Classement du tournoi"
            }))

    async def disconnect(self, close_code):
        if self.tournament_id is not None and self.tournament_id in TournamentConsumer.tournaments:
            tournament_id = self.tournament_id  # Store this before modifications
            tournament_players = TournamentConsumer.tournaments[tournament_id]
            
            if self in tournament_players:
                # Remove the player
                tournament_players.remove(self)
                
                # If tournament is empty, remove it
                if not tournament_players:
                    del TournamentConsumer.tournaments[tournament_id]
                else:
                    # Update positions for remaining players
                    for i, player in enumerate(tournament_players):
                        player.player_position = i + 1
                    
                    # Have one of the remaining players broadcast the updated state
                    if tournament_players:
                        await tournament_players[0].broadcast_tournament_state()
                        
class PongConsumer(AsyncWebsocketConsumer):

    clients = []
    shared_game_state = None
    waiting_players = []
    matchmaking_lock = asyncio.Lock() 

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.player_number = None
        self.match_task = None

    async def connect(self):
        self.user = self.scope["user"]
        self.tournament_id = None
        self.player_position = None
        self.match_id = None
        self.player_number = None
        if not self.user.is_authenticated:
            await self.close()
            return
            
        await self.accept()
        await self.join_matchmaking()

    async def join_matchmaking(self):
        async with PongConsumer.matchmaking_lock:
            await self.send(text_data=json.dumps({
                "waiting": True,
                "message": "Recherche d'un adversaire...",
                "matchmaking_status": {
                    "queue_position": len(PongConsumer.waiting_players) + 1,
                    "your_elo": self.user.elo
                }
            }))
            
            match_found = await self.find_match()
            
            if not match_found:
                PongConsumer.waiting_players.append((self, asyncio.get_event_loop().time(), self.user.elo))
                self.match_task = asyncio.create_task(self.periodic_match_check())

    async def find_match(self):
        if not PongConsumer.waiting_players:
            return False
        
        my_elo = self.user.elo
        best_match = None
        min_elo_diff = float('inf')
        
        for i, (player, timestamp, elo) in enumerate(PongConsumer.waiting_players):
            if player == self:
                continue
                
            elo_diff = abs(my_elo - elo)
            
            wait_time = asyncio.get_event_loop().time() - timestamp
            adjusted_diff = elo_diff / (1 + 0.1 * wait_time)  # Reduce difference based on wait time
            
            if adjusted_diff < min_elo_diff:
                min_elo_diff = adjusted_diff
                best_match = (i, player)
        
        if best_match and (min_elo_diff < 18 or 
                          asyncio.get_event_loop().time() - PongConsumer.waiting_players[best_match[0]][1] > 30):
            matched_idx, matched_player = best_match
            del PongConsumer.waiting_players[matched_idx]
            
            await self.create_game(matched_player)
            return True
        
        return False

    async def periodic_match_check(self):
        while True:
            await asyncio.sleep(5)  # Check every 5 seconds
            
            if not any(player == self for player, _, _ in PongConsumer.waiting_players):
                break
                
            async with PongConsumer.matchmaking_lock:
                for i, (player, timestamp, _) in enumerate(PongConsumer.waiting_players):
                    if player == self:
                        wait_time = int(asyncio.get_event_loop().time() - timestamp)
                        await self.send(text_data=json.dumps({
                            "waiting": True,
                            "message": f"Recherche d'un adversaire... ({wait_time}s)",
                            "matchmaking_status": {
                                "queue_position": i + 1,
                                "wait_time": wait_time,
                                "your_elo": self.user.elo
                            }
                        }))
                        break
                
                match_found = await self.find_match()
                if match_found:
                    break

    async def create_game(self, other_player):
        # Set player numbers
        self.player_number = 1
        other_player.player_number = 2
        
        PongConsumer.shared_game_state = {
            "ball": {"x": canvas_width / 2 - ball_radius / 2, "y": canvas_height / 2 - ball_radius / 2},
            "pads": {
                "player1": {"x": 10, "y": (canvas_height - pad_height) / 2},
                "player2": {"x": canvas_width - pad_width - 10, "y": (canvas_height - pad_height) / 2},
            },
            "score": {"player1": 0, "player2": 0},
            "directionBall": {"x": 1 if random() < 0.5 else -1, "y": 1 if random() < 0.5 else -1},
            "ballTouched": False,
            "count": 0,
            "inputs": {"player1": 0, "player2": 0},
            "waiting": False,
            "game_over": False,
            "player_info": {
                "player1": {"username": self.user.username, "elo": self.user.elo},
                "player2": {"username": other_player.user.username, "elo": other_player.user.elo}
            }
        }
        
        PongConsumer.clients = [self, other_player]
        
        if self.match_task:
            self.match_task.cancel()
        if other_player.match_task:
            other_player.match_task.cancel()
        
        for client in PongConsumer.clients:
            await client.send(text_data=json.dumps(PongConsumer.shared_game_state))
            
        asyncio.create_task(self.update_game_state())


    async def disconnect(self, close_code):
        if self.match_task:
            self.match_task.cancel()
            
        async with PongConsumer.matchmaking_lock:
            PongConsumer.waiting_players = [(p, ts, elo) for p, ts, elo in PongConsumer.waiting_players if p != self]
        
        if self in PongConsumer.clients:
        
            if self in self.clients:
                self.clients.remove(self)
                if len(self.clients) == 1:
                    remaining_client = self.clients[0]
                    await remaining_client.send(text_data=json.dumps({
                        "type": "player_left",
                        "message": "Votre adversaire a quitté la partie."
                    }))
                    await self.reset_game_state()
                    await remaining_client.close()
                    self.clients.clear()

    async def receive(self, text_data):
        data = json.loads(text_data)
        if "input" in data:
            player_key = f"player{self.player_number}"
            PongConsumer.shared_game_state["inputs"][player_key] = data["input"]
        # elif data['type'] == 'matchmaking':
        #     username = data['user']['username']
        #     elo = data['user']['elo']
        #     if self.player_number == 1:
        #         PongConsumer.shared_game_state['player_info']['player1']['username'] = username
        #         PongConsumer.shared_game_state['player_info']['player1']['elo'] = elo
        #     elif self.player_number == 2:
        #         PongConsumer.shared_game_state['player_info']['player2']['username'] = username
        #         PongConsumer.shared_game_state['player_info']['player2']['elo'] = elo

    async def update_game_state(self):
        while len(self.clients) == 2 and not PongConsumer.shared_game_state.get("game_over", False):
            self.update_pads()
            self.update_ball()
            self.collision_wall()
            self.collision_pad()
            await self.check_goals()
            for client in self.clients:
                await client.send(text_data=json.dumps(PongConsumer.shared_game_state))
            await asyncio.sleep(1 / 120)

    async def reset_game_state(self):
        PongConsumer.shared_game_state = {
            "ball": {"x": canvas_width / 2 - ball_radius / 2, "y": canvas_height / 2 - ball_radius / 2},
            "pads": {
                "player1": {"x": 10, "y": (canvas_height - pad_height) / 2},
                "player2": {"x": canvas_width - pad_width - 10, "y": (canvas_height - pad_height) / 2},
            },
            "score": {"player1": 0, "player2": 0},
            "directionBall": {"x": 1 if random() < 0.5 else -1, "y": 1 if random() < 0.5 else -1},
            "ballTouched": False,
            "count": 0,
            "inputs": {"player1": 0, "player2": 0},
            "waiting": True,
            "game_over": False,
        }
        tasks = [client.send(text_data=json.dumps(PongConsumer.shared_game_state)) for client in self.clients]
        await asyncio.gather(*tasks)

    def update_pads(self):
        PongConsumer.shared_game_state["pads"]["player1"]["y"] += PongConsumer.shared_game_state["inputs"]["player1"] * pad_speed
        PongConsumer.shared_game_state["pads"]["player2"]["y"] += PongConsumer.shared_game_state["inputs"]["player2"] * pad_speed

        PongConsumer.shared_game_state["pads"]["player1"]["y"] = max(0, min(PongConsumer.shared_game_state["pads"]["player1"]["y"], canvas_height - pad_height))
        PongConsumer.shared_game_state["pads"]["player2"]["y"] = max(0, min(PongConsumer.shared_game_state["pads"]["player2"]["y"], canvas_height - pad_height))

    def update_ball(self):
        ball_speed = PongConsumer.shared_game_state.get("ballSpeed", 3)
        PongConsumer.shared_game_state["ball"]["x"] += PongConsumer.shared_game_state["directionBall"]["x"] * ball_speed
        if PongConsumer.shared_game_state["ballTouched"]:
            PongConsumer.shared_game_state["ball"]["y"] += PongConsumer.shared_game_state["directionBall"]["y"] * ball_speed

    def collision_wall(self):
        if PongConsumer.shared_game_state["ball"]["y"] <= 0 or PongConsumer.shared_game_state["ball"]["y"] >= canvas_height - ball_radius:
            PongConsumer.shared_game_state["directionBall"]["y"] *= -1

    def collision_pad(self):
        if (PongConsumer.shared_game_state["ball"]["x"] <= PongConsumer.shared_game_state["pads"]["player1"]["x"] + pad_width and
            PongConsumer.shared_game_state["ball"]["x"] >= PongConsumer.shared_game_state["pads"]["player1"]["x"] and
            PongConsumer.shared_game_state["ball"]["y"] + ball_radius >= PongConsumer.shared_game_state["pads"]["player1"]["y"] and
            PongConsumer.shared_game_state["ball"]["y"] <= PongConsumer.shared_game_state["pads"]["player1"]["y"] + pad_height):
            self.handle_collision("player1")

        if (PongConsumer.shared_game_state["ball"]["x"] + ball_radius >= PongConsumer.shared_game_state["pads"]["player2"]["x"] and
            PongConsumer.shared_game_state["ball"]["x"] <= PongConsumer.shared_game_state["pads"]["player2"]["x"] + pad_width and
            PongConsumer.shared_game_state["ball"]["y"] + ball_radius >= PongConsumer.shared_game_state["pads"]["player2"]["y"] and
            PongConsumer.shared_game_state["ball"]["y"] <= PongConsumer.shared_game_state["pads"]["player2"]["y"] + pad_height):
            self.handle_collision("player2")

    def handle_collision(self, player):
        pad = PongConsumer.shared_game_state["pads"][player]
        impact = (PongConsumer.shared_game_state["ball"]["y"] + ball_radius / 2) - (pad["y"] + pad_height / 2)
        normalize_impact = impact / (pad_height / 2)
        bounce_angle = normalize_impact * (3.14159 / 3)

        PongConsumer.shared_game_state["directionBall"]["x"] = math.cos(bounce_angle) if player == "player1" else -math.cos(bounce_angle)
        PongConsumer.shared_game_state["directionBall"]["y"] = math.sin(bounce_angle)

        magnitude = math.sqrt(PongConsumer.shared_game_state["directionBall"]["x"] ** 2 + PongConsumer.shared_game_state["directionBall"]["y"] ** 2)
        PongConsumer.shared_game_state["directionBall"]["x"] /= magnitude
        PongConsumer.shared_game_state["directionBall"]["y"] /= magnitude

        PongConsumer.shared_game_state["count"] += 1
        PongConsumer.shared_game_state["ballSpeed"] = 4 + (PongConsumer.shared_game_state["count"] * 0.3)

        if player == "player1":
            PongConsumer.shared_game_state["ball"]["x"] = pad["x"] + pad_width + 1
        else:
            PongConsumer.shared_game_state["ball"]["x"] = pad["x"] - ball_radius - 1

        PongConsumer.shared_game_state["ballTouched"] = True

    async def check_goals(self):
        if PongConsumer.shared_game_state["ball"]["x"] <= 0:
            self.reset_ball("player2")
            PongConsumer.shared_game_state["score"]["player2"] += 1
            if PongConsumer.shared_game_state["score"]["player2"] >= 3:
                await self.end_game(PongConsumer.shared_game_state['player_info']['player2']['username'])
                PongConsumer.shared_game_state["game_over"] = True
        elif PongConsumer.shared_game_state["ball"]["x"] >= canvas_width:
            self.reset_ball("player1")
            PongConsumer.shared_game_state["score"]["player1"] += 1
            if PongConsumer.shared_game_state["score"]["player1"] >= 3:
                await self.end_game(PongConsumer.shared_game_state['player_info']['player1']['username'])
                PongConsumer.shared_game_state["game_over"] = True

    def reset_ball(self, scorer):
        PongConsumer.shared_game_state["ball"]["x"] = canvas_width / 2 - ball_radius / 2
        PongConsumer.shared_game_state["ball"]["y"] = canvas_height / 2 - ball_radius / 2
        PongConsumer.shared_game_state["directionBall"]["x"] = 1 if scorer == "player1" else -1
        PongConsumer.shared_game_state["directionBall"]["y"] = 0
        PongConsumer.shared_game_state["ballSpeed"] = 3
        PongConsumer.shared_game_state["count"] = 0
        PongConsumer.shared_game_state["ballTouched"] = False

    async def end_game(self, winner):

        if len(self.clients) == 2:
            winner_client = next((client for client in self.clients if client.user.username == winner), None)
            loser_client = next((client for client in self.clients if client.user.username != winner), None)

            if winner_client and loser_client and winner_client.user.is_authenticated and loser_client.user.is_authenticated:
                await self.update_user_elo(winner_client.user, loser_client.user)

        for client in self.clients:
            await client.send(text_data=json.dumps({
                "type": "game_over",
                "winner": winner,
                "message": f"Le joueur {winner} a gagné la partie !"
            }))
        await self.reset_game_state()
        for client in self.clients:
            await client.close()
        self.clients.clear()

    def expected(self, A, B):
        return 1 / (1 + 10 ** ((B - A) / 400))

    @database_sync_to_async
    def update_user_elo(self, winner, looser, K=20):

        winner_elo = winner.elo
        looser_elo = looser.elo

        expected_winner = self.expected(winner_elo, looser_elo)
        expected_looser = self.expected(looser_elo, winner_elo)

        winner_new_elo = winner_elo + K * (1 - expected_winner)
        looser_new_elo = looser_elo + K * (0 - expected_looser)

        winner_new_elo = round(winner_new_elo)
        looser_new_elo = round(looser_new_elo)

        winner.elo = winner_new_elo
        looser.elo = looser_new_elo
        winner.wins += 1
        looser.losses += 1

        winner.save()
        looser.save()