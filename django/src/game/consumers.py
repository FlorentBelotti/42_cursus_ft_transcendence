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

class PongConsumer(AsyncWebsocketConsumer):

    clients = []
    shared_game_state = None  # État partagé entre les instances

    waiting_players = []  # List of (consumer, timestamp, elo) tuples
    matchmaking_lock = asyncio.Lock() 

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.player_number = None  # Identifiant du joueur (1 ou 2)
        self.match_task = None

    async def connect(self):
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close()
            return
            
        await self.accept()
        
        # Join matchmaking system instead of directly creating a game
        await self.join_matchmaking()

    async def join_matchmaking(self):
        async with PongConsumer.matchmaking_lock:
            # Tell the player they're in matchmaking
            await self.send(text_data=json.dumps({
                "waiting": True,
                "message": "Recherche d'un adversaire...",
                "matchmaking_status": {
                    "queue_position": len(PongConsumer.waiting_players) + 1,
                    "your_elo": self.user.elo
                }
            }))
            
            # Try to find a match immediately
            match_found = await self.find_match()
            
            if not match_found:
                # If no match found, add to waiting queue with current timestamp
                PongConsumer.waiting_players.append((self, asyncio.get_event_loop().time(), self.user.elo))
                
                # Start periodic match checking
                self.match_task = asyncio.create_task(self.periodic_match_check())

    async def find_match(self):
        if not PongConsumer.waiting_players:
            return False
        
        my_elo = self.user.elo
        best_match = None
        min_elo_diff = float('inf')
        
        # Find closest ELO match
        for i, (player, timestamp, elo) in enumerate(PongConsumer.waiting_players):
            # Skip self if somehow in list
            if player == self:
                continue
                
            # Calculate ELO difference
            elo_diff = abs(my_elo - elo)
            
            # Factor in wait time (longer waits = more lenient matching)
            wait_time = asyncio.get_event_loop().time() - timestamp
            adjusted_diff = elo_diff / (1 + 0.1 * wait_time)  # Reduce difference based on wait time
            
            if adjusted_diff < min_elo_diff:
                min_elo_diff = adjusted_diff
                best_match = (i, player)
        
        # Match if ELO difference is small enough or player has been waiting too long
        if best_match and (min_elo_diff < 18 or 
                          asyncio.get_event_loop().time() - PongConsumer.waiting_players[best_match[0]][1] > 30):
            matched_idx, matched_player = best_match
            del PongConsumer.waiting_players[matched_idx]
            
            # Create game between these two players
            await self.create_game(matched_player)
            return True
        
        return False

    async def periodic_match_check(self):
        while True:
            await asyncio.sleep(5)  # Check every 5 seconds
            
            # If no longer in waiting list, stop checking
            if not any(player == self for player, _, _ in PongConsumer.waiting_players):
                break
                
            async with PongConsumer.matchmaking_lock:
                # Update status message with time in queue
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
                
                # Try to find a match again with possibly expanded criteria
                match_found = await self.find_match()
                if match_found:
                    break

    async def create_game(self, other_player):
        # Set player numbers
        self.player_number = 1
        other_player.player_number = 2
        
        # Initialize game state (similar to your existing code)
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
        
        # Add both players to clients list
        PongConsumer.clients = [self, other_player]
        
        # Stop the periodic match checking tasks
        if self.match_task:
            self.match_task.cancel()
        if other_player.match_task:
            other_player.match_task.cancel()
        
        # Send game state to both players
        for client in PongConsumer.clients:
            await client.send(text_data=json.dumps(PongConsumer.shared_game_state))
            
        # Start game loop
        asyncio.create_task(self.update_game_state())


    async def disconnect(self, close_code):
        if self.match_task:
            self.match_task.cancel()
            
        # Remove from waiting list if present
        async with PongConsumer.matchmaking_lock:
            PongConsumer.waiting_players = [(p, ts, elo) for p, ts, elo in PongConsumer.waiting_players if p != self]
        
        # Handle in-game disconnect (keep your existing code)
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
                    await remaining_client.close()  # Fermer la connexion du client restant
                    self.clients.clear()  # Vider la liste des clients

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
            # Find winner and loser users
            winner_client = next((client for client in self.clients if client.user.username == winner), None)
            loser_client = next((client for client in self.clients if client.user.username != winner), None)

            if winner_client and loser_client and winner_client.user.is_authenticated and loser_client.user.is_authenticated:
                # Update ELOs in database
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

        winner.save()
        looser.save()