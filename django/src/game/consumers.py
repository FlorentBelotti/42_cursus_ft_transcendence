from channels.generic.websocket import AsyncWebsocketConsumer
import json
import asyncio
import math
from random import random

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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.player_number = None  # Identifiant du joueur (1 ou 2)

    async def connect(self):
        await self.accept()
        
        if len(self.clients) == 0:
            # Premier joueur se connecte
            self.player_number = 1
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
            await self.send(text_data=json.dumps({
                "waiting": True,
                "message": "Vous êtes en attente d'un adversaire..."
            }))
        elif len(self.clients) == 1:
            # Deuxième joueur se connecte
            self.player_number = 2
            PongConsumer.shared_game_state["waiting"] = False
            asyncio.create_task(self.update_game_state())
        
        self.clients.append(self)
        
        if len(self.clients) == 2:
            # Envoyer l'état initial aux deux joueurs
            for client in self.clients:
                await client.send(text_data=json.dumps(PongConsumer.shared_game_state))


    async def disconnect(self, close_code):
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
                await self.end_game("player2")
                PongConsumer.shared_game_state["game_over"] = True
        elif PongConsumer.shared_game_state["ball"]["x"] >= canvas_width:
            self.reset_ball("player1")
            PongConsumer.shared_game_state["score"]["player1"] += 1
            if PongConsumer.shared_game_state["score"]["player1"] >= 3:
                await self.end_game("player1")
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