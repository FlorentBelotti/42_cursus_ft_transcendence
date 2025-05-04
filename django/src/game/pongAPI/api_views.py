from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
import json
import traceback

from .serializers import GameStateSerializer, PaddleInputSerializer, MatchmakingSerializer
from .pongLobby import LobbyManager
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.shortcuts import get_object_or_404
from users.models import customUser
from .api_consumer import APIMatchConsumer

# Logger configuration
logger = logging.getLogger('pong.api')

# Singleton for the lobby manager
lobby_manager = LobbyManager()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def game_status(request):
    """
    Gets the game status for the connected user
    """
    user = request.user
    logger.info(f"Status request for user {user.username}")
    
    # Check if the user is in an active game
    match_data = None
    player_number = None
    match_id = None
    
    for mid, match in lobby_manager.active_matches.items():
        for i, player in enumerate(match['players']):
            if hasattr(player, 'user') and player.user.id == user.id:
                match_data = match
                player_number = i + 1
                match_id = mid
                logger.info(f"User {user.username} found in match {mid} as player {player_number}")
                break
        if match_data:
            break
    
    if not match_data:
        logger.info(f"User {user.username} is not in an active game")
        return Response({
            'in_game': False,
            'message': "The user is not in an active game"
        })
    
    # Serialize the game state
    serializer = GameStateSerializer(match_data['game_state'])
    
    return Response({
        'in_game': True,
        'player_number': player_number,
        'match_id': match_id,
        'game_state': serializer.data
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def game_score(request):
    """
    Gets the score of the active game for the connected user
    """
    user = request.user
    logger.info(f"Score request for user {user.username}")
    
    # Check if the user is in an active game
    match_data = None
    match_id = None
    
    for mid, match in lobby_manager.active_matches.items():
        for player in match['players']:
            if hasattr(player, 'user') and player.user.id == user.id:
                match_data = match
                match_id = mid
                break
        if match_data:
            break
    
    if not match_data:
        logger.info(f"User {user.username} is not in an active game to view the score")
        return Response({
            'error': "The user is not in an active game"
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Retrieve only the scores
    player1_username = match_data['game_state']['player_info']['player1']['username']
    player2_username = match_data['game_state']['player_info']['player2']['username']
    
    return Response({
        'match_id': match_id,
        'player1': {
            'username': player1_username,
            'score': match_data['game_state']['score']['player1']
        },
        'player2': {
            'username': player2_username,
            'score': match_data['game_state']['score']['player2']
        }
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_matchmaking(request):
    """
    Starts matchmaking for the user
    """
    user = request.user
    logger.info(f"Starting matchmaking for user {user.username}")
    
    # Check if already in a match
    for match_id, match in lobby_manager.active_matches.items():
        for player in match['players']:
            if hasattr(player, 'user') and player.user.id == user.id:
                logger.warning(f"User {user.username} already in an active game {match_id}")
                return Response({
                    'error': "The user is already in an active game",
                    'match_id': match_id
                }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if already in the queue
    for player, _, _ in lobby_manager.waiting_players:
        if hasattr(player, 'user') and player.user.id == user.id:
            queue_position = 0
            for i, (p, _, _) in enumerate(lobby_manager.waiting_players):
                if p == player:
                    queue_position = i + 1
                    break
                    
            logger.info(f"User {user.username} already in the queue (position: {queue_position})")
            return Response({
                'status': 'in_queue',
                'message': "The user is already in the queue",
                'queue_position': queue_position
            })
    
    # Create a simulation of a consumer for the API
    api_consumer = APIMatchConsumer(user)
    logger.info(f"Creating an APIMatchConsumer for user {user.username}")
    
    try:
        # Add the player to the queue
        async_to_sync(lobby_manager.add_player_to_queue)(api_consumer)
        
        # Try to find a match immediately
        match_found = async_to_sync(lobby_manager.find_match_for_player)(api_consumer)
        
        # Find the position in the queue
        queue_position = 0
        for i, (p, _, _) in enumerate(lobby_manager.waiting_players):
            if hasattr(p, 'user') and p.user.id == user.id:
                queue_position = i + 1
                break
        
        if match_found:
            # Get information about the match
            last_message = api_consumer.get_last_message()
            match_id = api_consumer.match_id or (last_message.get('match_id') if last_message else None)
            opponent = last_message.get('opponent') if last_message else "opponent"
            
            logger.info(f"Match found for {user.username}: match_id={match_id}, opponent={opponent}")
            
            return Response({
                'status': 'match_found',
                'message': 'An opponent has been found!',
                'match_id': match_id,
                'player_number': api_consumer.player_number,
                'opponent': opponent
            })
        else:
            logger.info(f"No immediate match found for {user.username}, position in queue: {queue_position}")
            
            # Start a background task to continue the search
            try:
                import threading
                def background_matchmaking():
                    try:
                        logger.info(f"Starting background search for {user.username}")
                        # Try to find a match for up to 30 seconds
                        for _ in range(15):  # 15 attempts at 2-second intervals = 30 seconds
                            logger.debug(f"Matchmaking attempt for {user.username}")
                            try:
                                if async_to_sync(lobby_manager.find_matches_for_all)() > 0:
                                    logger.info(f"Match found in background for {user.username}")
                                    break
                            except Exception as e:
                                logger.error(f"Error during background search: {e}")
                            import time
                            time.sleep(2)
                    except Exception as e:
                        logger.error(f"Error in matchmaking thread: {e}")
                        traceback.print_exc()
                
                # Start background search
                t = threading.Thread(target=background_matchmaking)
                t.daemon = True
                t.start()
                
                logger.info(f"Search thread started for {user.username}")
            except Exception as e:
                logger.error(f"Error starting search thread: {e}")
            
            return Response({
                'status': 'in_queue',
                'message': 'Waiting for an opponent...',
                'queue_position': queue_position
            })
    except Exception as e:
        logger.error(f"Error during matchmaking for {user.username}: {str(e)}")
        traceback.print_exc()
        return Response({
            'error': f"An error occurred during matchmaking: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def move_paddle(request):
    """
    Moves the paddle of the active player
    """
    user = request.user
    logger.debug(f"Paddle movement request for {user.username}")
    
    serializer = PaddleInputSerializer(data=request.data)
    
    if not serializer.is_valid():
        logger.warning(f"Invalid data for paddle movement: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    input_value = serializer.validated_data['input']
    match_data = None
    player_number = None
    match_id = None
    
    # Find the active game for the user
    for mid, match in lobby_manager.active_matches.items():
        for i, player in enumerate(match['players']):
            if hasattr(player, 'user') and player.user.id == user.id:
                match_data = match
                player_number = i + 1
                match_id = mid
                break
        if match_data:
            break
    
    if not match_data:
        logger.warning(f"User {user.username} is not in an active game to move their paddle")
        return Response({
            'error': "The user is not in an active game"
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Update the game state with the input
    player_key = f"player{player_number}"
    match_data["game_state"]["inputs"][player_key] = input_value
    logger.debug(f"Movement {input_value} applied for {user.username} (player {player_number}) in match {match_id}")
    
    return Response({
        'status': 'success',
        'input_processed': input_value,
        'player_number': player_number,
        'match_id': match_id
    })