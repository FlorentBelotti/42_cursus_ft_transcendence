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
        "waiting": True,
        "game_over": False,  # Nouvelle variable pour contrôler la fin de la partie
    }

    clients = []

    async def connect(self):
        await self.accept()
        self.clients.append(self)

        if len(self.clients) == 1:
            self.game_state["waiting"] = True
            await self.send(text_data=json.dumps({
                "waiting": True,
                "message": "Vous êtes en attente d'un adversaire..."
            }))
        elif len(self.clients) == 2:
            self.game_state["waiting"] = False
            await self.send(text_data=json.dumps(self.game_state))
            asyncio.create_task(self.update_game_state())

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
            if self == self.clients[0]:  # Joueur 1
                self.game_state["inputs"]["player1"] = data["input"]
            elif self == self.clients[1]:  # Joueur 2
                self.game_state["inputs"]["player2"] = data["input"]

    async def update_game_state(self):
        while len(self.clients) == 2 and not self.game_state.get("game_over", False):
            self.update_pads()
            self.update_ball()
            self.collision_wall()
            self.collision_pad()
            await self.check_goals()
            for client in self.clients:
                await client.send(text_data=json.dumps(self.game_state))
            await asyncio.sleep(1 / 120)

    async def reset_game_state(self):
        self.game_state = {
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
        # Envoyer l'état réinitialisé à tous les clients
        for client in self.clients:
            asyncio.create_task(client.send(text_data=json.dumps(self.game_state)))

    def update_pads(self):
        self.game_state["pads"]["player1"]["y"] += self.game_state["inputs"]["player1"] * pad_speed
        self.game_state["pads"]["player2"]["y"] += self.game_state["inputs"]["player2"] * pad_speed

        self.game_state["pads"]["player1"]["y"] = max(0, min(self.game_state["pads"]["player1"]["y"], canvas_height - pad_height))
        self.game_state["pads"]["player2"]["y"] = max(0, min(self.game_state["pads"]["player2"]["y"], canvas_height - pad_height))

    def update_ball(self):
        ball_speed = self.game_state.get("ballSpeed", 3)
        self.game_state["ball"]["x"] += self.game_state["directionBall"]["x"] * ball_speed
        if self.game_state["ballTouched"]:
            self.game_state["ball"]["y"] += self.game_state["directionBall"]["y"] * ball_speed

    def collision_wall(self):
        if self.game_state["ball"]["y"] <= 0 or self.game_state["ball"]["y"] >= canvas_height - ball_radius:
            self.game_state["directionBall"]["y"] *= -1

    def collision_pad(self):
        if (self.game_state["ball"]["x"] <= self.game_state["pads"]["player1"]["x"] + pad_width and
            self.game_state["ball"]["x"] >= self.game_state["pads"]["player1"]["x"] and
            self.game_state["ball"]["y"] + ball_radius >= self.game_state["pads"]["player1"]["y"] and
            self.game_state["ball"]["y"] <= self.game_state["pads"]["player1"]["y"] + pad_height):
            self.handle_collision("player1")

        if (self.game_state["ball"]["x"] + ball_radius >= self.game_state["pads"]["player2"]["x"] and
            self.game_state["ball"]["x"] <= self.game_state["pads"]["player2"]["x"] + pad_width and
            self.game_state["ball"]["y"] + ball_radius >= self.game_state["pads"]["player2"]["y"] and
            self.game_state["ball"]["y"] <= self.game_state["pads"]["player2"]["y"] + pad_height):
            self.handle_collision("player2")

    def handle_collision(self, player):
        pad = self.game_state["pads"][player]
        impact = (self.game_state["ball"]["y"] + ball_radius / 2) - (pad["y"] + pad_height / 2)
        normalize_impact = impact / (pad_height / 2)
        bounce_angle = normalize_impact * (3.14159 / 3)

        self.game_state["directionBall"]["x"] = math.cos(bounce_angle) if player == "player1" else -math.cos(bounce_angle)
        self.game_state["directionBall"]["y"] = math.sin(bounce_angle)

        magnitude = math.sqrt(self.game_state["directionBall"]["x"] ** 2 + self.game_state["directionBall"]["y"] ** 2)
        self.game_state["directionBall"]["x"] /= magnitude
        self.game_state["directionBall"]["y"] /= magnitude

        self.game_state["count"] += 1
        self.game_state["ballSpeed"] = 4 + (self.game_state["count"] * 0.3)

        if player == "player1":
            self.game_state["ball"]["x"] = pad["x"] + pad_width + 1
        else:
            self.game_state["ball"]["x"] = pad["x"] - ball_radius - 1

        self.game_state["ballTouched"] = True

    async def check_goals(self):
        if self.game_state["ball"]["x"] <= 0:
            self.reset_ball("player2")
            self.game_state["score"]["player2"] += 1
            if self.game_state["score"]["player2"] >= 3:
                await self.end_game("player2")
                self.game_state["game_over"] = True
        elif self.game_state["ball"]["x"] >= canvas_width:
            self.reset_ball("player1")
            self.game_state["score"]["player1"] += 1
            if self.game_state["score"]["player1"] >= 3:
                await self.end_game("player1")
                self.game_state["game_over"] = True

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

    def reset_ball(self, scorer):
        self.game_state["ball"]["x"] = canvas_width / 2 - ball_radius / 2
        self.game_state["ball"]["y"] = canvas_height / 2 - ball_radius / 2
        self.game_state["directionBall"]["x"] = 1 if scorer == "player1" else -1
        self.game_state["directionBall"]["y"] = 0
        self.game_state["ballSpeed"] = 3
        self.game_state["count"] = 0
        self.game_state["ballTouched"] = False