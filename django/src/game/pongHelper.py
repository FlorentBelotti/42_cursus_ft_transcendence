"""
╔═══════════════════════════════════════════════════╗
║                 PongHelper                        ║
╠═══════════════════════════════════════════════════╣
║ Utility functions and constants for Pong game     ║
║                                                   ║
║ • Defines game dimensions and physics constants   ║
║ • Manages game state creation and reset           ║
║ • Handles ELO rating calculations                 ║
║ • Provides common utility functions               ║
╚═══════════════════════════════════════════════════╝
"""

from datetime import datetime
import math
from random import random

# Game constants
CANVAS_WIDTH = 800
CANVAS_HEIGHT = 550
PAD_WIDTH = 20
PAD_HEIGHT = 90
PAD_SPEED = 8
BALL_RADIUS = 7
BALL_SPEED = 5

def get_display_name(user):
    """
    Returns the display name for a user, using nickname if available.e
    """

    return user.nickname if hasattr(user, 'nickname') and user.nickname else user.username

def create_initial_game_state(player1, player2, match_id=None, tournament_id=None):
    """
    Creates the initial game state for a Pong match.
    """

    game_state = {
        "ball": {"x": CANVAS_WIDTH / 2 - BALL_RADIUS / 2, "y": CANVAS_HEIGHT / 2 - BALL_RADIUS / 2},
        "pads": {
            "player1": {"x": 10, "y": (CANVAS_HEIGHT - PAD_HEIGHT) / 2},
            "player2": {"x": CANVAS_WIDTH - PAD_WIDTH - 10, "y": (CANVAS_HEIGHT - PAD_HEIGHT) / 2},
        },
        "score": {"player1": 0, "player2": 0},
        "directionBall": {"x": 1 if random() < 0.5 else -1, "y": 1 if random() < 0.5 else -1},
        "ballTouched": False,
        "count": 0,
        "inputs": {"player1": 0, "player2": 0},
        "player_info": {
            "player1": {
                "username": player1.user.username,
                "nickname": player1.user.nickname if hasattr(player1.user, 'nickname') and player1.user.nickname else None,
                "elo": player1.user.elo
            },
            "player2": {
                "username": player2.user.username,
                "nickname": player2.user.nickname if hasattr(player2.user, 'nickname') and player2.user.nickname else None,
                "elo": player2.user.elo
            }
        }
    }

    if match_id:
        game_state["match_id"] = match_id

    if tournament_id:
        game_state["tournament_id"] = tournament_id

    return game_state

def reset_ball(game_state, scorer=None):
    """
    Resets the ball to the center of the game after a score.
    """

    game_state["ball"]["x"] = CANVAS_WIDTH / 2 - BALL_RADIUS / 2
    game_state["ball"]["y"] = CANVAS_HEIGHT / 2 - BALL_RADIUS / 2

    if scorer:
        game_state["directionBall"]["x"] = 1 if scorer == "player1" else -1
    else:
        game_state["directionBall"]["x"] = 1 if random() < 0.5 else -1

    game_state["directionBall"]["y"] = 1 if random() < 0.5 else -1
    game_state["ballSpeed"] = BALL_SPEED
    game_state["count"] = 0
    game_state["ballTouched"] = False

    return game_state

def calculate_elo_change(winner_elo, loser_elo, k_factor=20):
    """
    Calculates ELO rating changes after a match.
    """

    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    expected_loser = 1 / (1 + 10 ** ((winner_elo - loser_elo) / 400))

    winner_new_elo = winner_elo + k_factor * (1 - expected_winner)
    loser_new_elo = loser_elo + k_factor * (0 - expected_loser)

    return round(winner_new_elo), round(loser_new_elo)

def now_str():
    """
    Returns the current datetime as a string.
    """

    return str(datetime.now())
