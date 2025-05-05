from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .pongLobby import LobbyManager
from .pongHelper import get_display_name, create_initial_game_state
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json

User = get_user_model()
lobby_manager = LobbyManager()

class SearchGameAPI(APIView):
    """
    API to add a player to the matchmaking queue or start a new game.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        try:
            # Simulate adding player to queue (actual matchmaking happens via WebSocket)
            # For simplicity, return a message indicating the player is queued
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}",
                {
                    "type": "queue_message",
                    "message": {
                        "status": "queued",
                        "message": "You have been added to the matchmaking queue."
                    }
                }
            )
            return Response({
                "status": "success",
                "message": "Searching for a game..."
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "error",
                "message": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GameStateAPI(APIView):
    """
    API to retrieve the state of a specific game by match_id.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, match_id):
        try:
            match = lobby_manager.active_matches.get(match_id)
            if not match:
                return Response({
                    "status": "error",
                    "message": "Game not found."
                }, status=status.HTTP_404_NOT_FOUND)

            game_state = match["game_state"]
            players = match["players"]
            state_summary = {
                "match_id": match_id,
                "status": "in_progress" if game_state.get("score") else "waiting",
                "players": [
                    {
                        "username": get_display_name(p.user),
                        "elo": p.user.elo
                    } for p in players
                ],
                "score": game_state["score"],
                "created_at": match["created_at"]
            }
            return Response({
                "status": "success",
                "data": state_summary
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "error",
                "message": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MovePaddleAPI(APIView):
    """
    API to move a player's paddle up or down in an active game.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, match_id):
        try:
            direction = request.data.get("direction")  # Expecting "up" or "down"
            if direction not in ["up", "down"]:
                return Response({
                    "status": "error",
                    "message": "Invalid direction. Use 'up' or 'down'."
                }, status=status.HTTP_400_BAD_REQUEST)

            match = lobby_manager.active_matches.get(match_id)
            if not match:
                return Response({
                    "status": "error",
                    "message": "Game not found."
                }, status=status.HTTP_404_NOT_FOUND)

            # Find the player in the match
            player = next((p for p in match["players"] if p.user.id == request.user.id), None)
            if not player:
                return Response({
                    "status": "error",
                    "message": "You are not a participant in this game."
                }, status=status.HTTP_403_FORBIDDEN)

            # Update game state inputs
            player_number = f"player{player.player_number}"
            match["game_state"]["inputs"][player_number] = -1 if direction == "up" else 1

            # Notify game loop via WebSocket
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"match_{match_id}",
                {
                    "type": "game_update",
                    "game_state": match["game_state"]
                }
            )
            return Response({
                "status": "success",
                "message": f"Paddle moved {direction}."
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "error",
                "message": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)