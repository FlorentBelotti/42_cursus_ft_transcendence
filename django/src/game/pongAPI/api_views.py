from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
import json
import traceback

from .serializers import GameStateSerializer, PaddleInputSerializer, MatchmakingSerializer
from ..pongLobby import LobbyManager
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.shortcuts import get_object_or_404
from users.models import customUser
from .api_consumer import APIMatchConsumer

# DEBUG
logger = logging.getLogger('pong.api')

# CREATE LOBBY INSTANCE (ONLY INITIALIZE)
lobby_manager = LobbyManager()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def game_status(request):
    user = request.user
    logger.info(f"Requête status pour l'utilisateur {user.username}")
    
    # CHECK FOR ACTIVE GAME
    match_data = None
    player_number = None
    match_id = None
    
    for mid, match in lobby_manager.active_matches.items():
        for i, player in enumerate(match['players']):
            if hasattr(player, 'user') and player.user.id == user.id:
                match_data = match
                player_number = i + 1
                match_id = mid
                logger.info(f"Utilisateur {user.username} trouvé dans la partie {mid} en tant que joueur {player_number}")
                break
        if match_data:
            break
    
    if not match_data:
        logger.info(f"Utilisateur {user.username} n'est pas dans une partie active")
        return Response({
            'in_game': False,
            'message': "L'utilisateur n'est pas dans une partie active"
        })
    
    # SERIALIZE GAME STATE
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
    user = request.user
    logger.info(f"Requête score pour l'utilisateur {user.username}")

    # CHECK GAME STATE
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
        logger.info(f"Utilisateur {user.username} n'est pas dans une partie active pour voir le score")
        return Response({
            'error': "L'utilisateur n'est pas dans une partie active"
        }, status=status.HTTP_404_NOT_FOUND)
    
    # GET SCORE
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
    user = request.user
    logger.info(f"Démarrage du matchmaking pour l'utilisateur {user.username}")
    
    # CHECK GAME STATE
    for match_id, match in lobby_manager.active_matches.items():
        for player in match['players']:
            if hasattr(player, 'user') and player.user.id == user.id:
                logger.warning(f"Utilisateur {user.username} déjà dans une partie active {match_id}")
                return Response({
                    'error': "L'utilisateur est déjà dans une partie active",
                    'match_id': match_id
                }, status=status.HTTP_400_BAD_REQUEST)
    
    # CHECK QUEUE
    for player, _, _ in lobby_manager.waiting_players:
        if hasattr(player, 'user') and player.user.id == user.id:
            queue_position = 0
            for i, (p, _, _) in enumerate(lobby_manager.waiting_players):
                if p == player:
                    queue_position = i + 1
                    break
                    
            logger.info(f"Utilisateur {user.username} déjà en file d'attente (position: {queue_position})")
            return Response({
                'status': 'in_queue',
                'message': "L'utilisateur est déjà en file d'attente",
                'queue_position': queue_position
            })
    
    # API CONSUMMER CLASS
    api_consumer = APIMatchConsumer(user)
    logger.info(f"Création d'un APIMatchConsumer pour l'utilisateur {user.username}")
    
    try:
        # ADD TO QUEUE
        async_to_sync(lobby_manager.add_player_to_queue)(api_consumer)
        
        # FIND MATCH DIRECTLY
        match_found = async_to_sync(lobby_manager.find_match_for_player)(api_consumer)
        
        # QUEUE POSITION
        queue_position = 0
        for i, (p, _, _) in enumerate(lobby_manager.waiting_players):
            if hasattr(p, 'user') and p.user.id == user.id:
                queue_position = i + 1
                break
        
        if match_found:
            last_message = api_consumer.get_last_message()
            match_id = api_consumer.match_id or (last_message.get('match_id') if last_message else None)
            opponent = last_message.get('opponent') if last_message else "adversaire"
            
            logger.info(f"Match trouvé pour {user.username}: match_id={match_id}, adversaire={opponent}")
            
            return Response({
                'status': 'match_found',
                'message': 'Un adversaire a été trouvé!',
                'match_id': match_id,
                'player_number': api_consumer.player_number,
                'opponent': opponent
            })
        else:
            logger.info(f"Aucun match immédiat trouvé pour {user.username}, position dans la file: {queue_position}")
            
            # KEEP SEARCHING
            try:
                import threading
                def background_matchmaking():
                    try:
                        logger.info(f"Démarrage de la recherche en arrière-plan pour {user.username}")
                        for _ in range(15):
                            logger.debug(f"Tentative de matchmaking pour {user.username}")
                            try:
                                if async_to_sync(lobby_manager.find_matches_for_all)() > 0:
                                    logger.info(f"Match trouvé en arrière-plan pour {user.username}")
                                    break
                            except Exception as e:
                                logger.error(f"Erreur lors de la recherche en arrière-plan: {e}")
                            import time
                            time.sleep(2)
                    except Exception as e:
                        logger.error(f"Erreur dans le thread de matchmaking: {e}")
                        traceback.print_exc()
                
                # START BACKGROUND SEARCH
                t = threading.Thread(target=background_matchmaking)
                t.daemon = True
                t.start()
                
                logger.info(f"Thread de recherche démarré pour {user.username}")
            except Exception as e:
                logger.error(f"Erreur lors du démarrage du thread de recherche: {e}")
            
            return Response({
                'status': 'in_queue',
                'message': 'En attente d\'un adversaire...',
                'queue_position': queue_position
            })
    except Exception as e:
        logger.error(f"Erreur lors du matchmaking pour {user.username}: {str(e)}")
        traceback.print_exc()
        return Response({
            'error': f"Une erreur s'est produite lors du matchmaking: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def move_paddle(request):
    user = request.user
    logger.debug(f"Requête de mouvement de raquette pour {user.username}")
    
    serializer = PaddleInputSerializer(data=request.data)
    
    if not serializer.is_valid():
        logger.warning(f"Données invalides pour le mouvement de raquette: {request.data}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    input_value = serializer.validated_data['input']
    match_data = None
    player_number = None
    match_id = None
    
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
        logger.warning(f"Utilisateur {user.username} n'est pas dans une partie active pour bouger sa raquette")
        return Response({
            'error': "L'utilisateur n'est pas dans une partie active"
        }, status=status.HTTP_404_NOT_FOUND)
    
    player_key = f"player{player_number}"
    match_data["game_state"]["inputs"][player_key] = input_value
    logger.debug(f"Mouvement {input_value} appliqué pour {user.username} (joueur {player_number}) dans le match {match_id}")
    
    return Response({
        'status': 'success',
        'input_processed': input_value,
        'player_number': player_number,
        'match_id': match_id
    })