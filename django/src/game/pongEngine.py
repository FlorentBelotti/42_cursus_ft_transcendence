import math
import asyncio
from .pongHelper import CANVAS_WIDTH, CANVAS_HEIGHT, PAD_WIDTH, PAD_HEIGHT, PAD_SPEED, BALL_RADIUS, BALL_SPEED, reset_ball

class GameEngine:
    """
    ╔═══════════════════════════════════════════════════╗
    ║                GameEngine                         ║
    ╠═══════════════════════════════════════════════════╣
    ║ Core physics and logic for Pong game              ║
    ║                                                   ║
    ║ • Handles paddle movement and constraints         ║
    ║ • Processes ball physics and collision detection  ║
    ║ • Manages bounce angles and speed increases       ║
    ║ • Tracks scoring and determines game completion   ║
    ╚═══════════════════════════════════════════════════╝
    """

    #===========================================================#
    #                GAME STATE                                 #
    #===========================================================#

    def update_game_state(self, game_state):
        """
        Updates the entire game state for one frame.
        """

        self.update_pads(game_state)
        self.update_ball(game_state)
        self.collision_wall(game_state)
        self.collision_pad(game_state)
        return game_state

    async def check_goals(self, game_state):
        """
        Checks if a goal was scored and updates the score.
        """

        # Player 2 scores
        if game_state["ball"]["x"] <= 0:
            reset_ball(game_state, "player2")
            game_state["score"]["player2"] += 1
            if game_state["score"]["player2"] >= 3:
                return True, game_state["player_info"]["player2"]["username"]
        
        # Player 1 scores
        elif game_state["ball"]["x"] >= CANVAS_WIDTH:
            reset_ball(game_state, "player1")
            game_state["score"]["player1"] += 1
            if game_state["score"]["player1"] >= 3:
                return True, game_state["player_info"]["player1"]["username"]
                
        return False, None

    #===========================================================#
    #                GAME PHYSICS                               #
    #===========================================================#

    def update_pads(self, game_state):
        """
        Updates paddle positions based on player inputs.
        """

        game_state["pads"]["player1"]["y"] += game_state["inputs"]["player1"] * PAD_SPEED
        game_state["pads"]["player2"]["y"] += game_state["inputs"]["player2"] * PAD_SPEED

        # Keep paddles within canvas boundaries
        game_state["pads"]["player1"]["y"] = max(0, min(game_state["pads"]["player1"]["y"], CANVAS_HEIGHT - PAD_HEIGHT))
        game_state["pads"]["player2"]["y"] = max(0, min(game_state["pads"]["player2"]["y"], CANVAS_HEIGHT - PAD_HEIGHT))

    def update_ball(self, game_state):
        """
        Updates ball position based on its current direction and speed.
        """

        ball_speed = game_state.get("ballSpeed", BALL_SPEED)
        game_state["ball"]["x"] += game_state["directionBall"]["x"] * ball_speed
        if game_state["ballTouched"]:
            game_state["ball"]["y"] += game_state["directionBall"]["y"] * ball_speed

    def collision_wall(self, game_state):
        """
        Handles ball collision with top and bottom walls.
        """

        if game_state["ball"]["y"] <= 0 or game_state["ball"]["y"] >= CANVAS_HEIGHT - BALL_RADIUS:
            game_state["directionBall"]["y"] *= -1

    def collision_pad(self, game_state):
        """
        Detects and handles ball collision with paddles.
        """

        # Left paddle (player1) collision
        if (game_state["ball"]["x"] <= game_state["pads"]["player1"]["x"] + PAD_WIDTH and
            game_state["ball"]["x"] >= game_state["pads"]["player1"]["x"] and
            game_state["ball"]["y"] + BALL_RADIUS >= game_state["pads"]["player1"]["y"] and
            game_state["ball"]["y"] <= game_state["pads"]["player1"]["y"] + PAD_HEIGHT):
            self.handle_collision(game_state, "player1")

        # Right paddle (player2) collision
        if (game_state["ball"]["x"] + BALL_RADIUS >= game_state["pads"]["player2"]["x"] and
            game_state["ball"]["x"] <= game_state["pads"]["player2"]["x"] + PAD_WIDTH and
            game_state["ball"]["y"] + BALL_RADIUS >= game_state["pads"]["player2"]["y"] and
            game_state["ball"]["y"] <= game_state["pads"]["player2"]["y"] + PAD_HEIGHT):
            self.handle_collision(game_state, "player2")

    def handle_collision(self, game_state, player):
        """
        Calculates ball bounce physics when hitting a paddle.
        """
        pad = game_state["pads"][player]
        
        # Calculate impact point relative to paddle center
        impact = (game_state["ball"]["y"] + BALL_RADIUS / 2) - (pad["y"] + PAD_HEIGHT / 2)
        normalize_impact = impact / (PAD_HEIGHT / 2)
        bounce_angle = normalize_impact * (3.14159 / 3)

        # Set new direction based on which paddle was hit
        game_state["directionBall"]["x"] = math.cos(bounce_angle) if player == "player1" else -math.cos(bounce_angle)
        game_state["directionBall"]["y"] = math.sin(bounce_angle)

        # Normalize vector to maintain consistent speed
        magnitude = math.sqrt(game_state["directionBall"]["x"] ** 2 + game_state["directionBall"]["y"] ** 2)
        game_state["directionBall"]["x"] /= magnitude
        game_state["directionBall"]["y"] /= magnitude

        # Increase ball speed with each hit
        game_state["count"] += 1
        game_state["ballSpeed"] = 4 + (game_state["count"] * 0.3)

        # Adjust ball position to prevent sticking to paddle
        if player == "player1":
            game_state["ball"]["x"] = pad["x"] + PAD_WIDTH + 1
        else:
            game_state["ball"]["x"] = pad["x"] - BALL_RADIUS - 1

        game_state["ballTouched"] = True