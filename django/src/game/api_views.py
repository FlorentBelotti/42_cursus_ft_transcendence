from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .serializers import GameStateSerializer, PaddleInputSerializer, MatchmakingSerializer
from .pongLobby import LobbyManager
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.shortcuts import get_object_or_404
from users.models import customUser
from .api_consumer import APIMatchConsumer

# Singleton pour le lobby manager
lobby_manager = LobbyManager()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def game_status(request):
    """
    Récupère le statut du jeu pour l'utilisateur connecté
    """
    user = request.user
    
    # Vérifier si l'utilisateur est dans une partie active
    match_data = None
    player_number = None
    
    for match_id, match in lobby_manager.active_matches.items():
        for i, player in enumerate(match['players']):
            if player.user.id == user.id:
                match_data = match
                player_number = i + 1
                break
        if match_data:
            break
    
    if not match_data:
        return Response({
            'in_game': False,
            'message': "L'utilisateur n'est pas dans une partie active"
        })
    
    # Sérialiser l'état du jeu
    serializer = GameStateSerializer(match_data['game_state'])
    
    return Response({
        'in_game': True,
        'player_number': player_number,
        'game_state': serializer.data
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def game_score(request):
    """
    Récupère le score de la partie active pour l'utilisateur connecté
    """
    user = request.user
    
    # Vérifier si l'utilisateur est dans une partie active
    match_data = None
    match_id = None
    
    for mid, match in lobby_manager.active_matches.items():
        for player in match['players']:
            if player.user.id == user.id:
                match_data = match
                match_id = mid
                break
        if match_data:
            break
    
    if not match_data:
        return Response({
            'error': "L'utilisateur n'est pas dans une partie active"
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Récupérer uniquement les scores
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
    Démarre la recherche d'un match pour l'utilisateur
    """
    user = request.user
    
    # Vérifier si déjà dans un match
    for match_id, match in lobby_manager.active_matches.items():
        for player in match['players']:
            if hasattr(player, 'user') and player.user.id == user.id:
                return Response({
                    'error': "L'utilisateur est déjà dans une partie active"
                }, status=status.HTTP_400_BAD_REQUEST)
    
    # Vérifier si déjà en file d'attente
    for player, _, _ in lobby_manager.waiting_players:
        if hasattr(player, 'user') and player.user.id == user.id:
            return Response({
                'message': "L'utilisateur est déjà en file d'attente"
            })
    
    # Créer une simulation d'un consumer pour l'API
    api_consumer = APIMatchConsumer(user)
    
    # Ajouter le joueur à la file d'attente
    async_to_sync(lobby_manager.add_player_to_queue)(api_consumer)
    
    # Tenter de trouver un match immédiatement
    match_found = async_to_sync(lobby_manager.find_match_for_player)(api_consumer)
    
    if match_found:
        return Response({
            'status': 'match_found',
            'message': 'Un adversaire a été trouvé!',
            'match_id': api_consumer.match_id
        })
    else:
        return Response({
            'status': 'in_queue',
            'message': 'En attente d\'un adversaire...',
            'queue_position': len(lobby_manager.waiting_players)
        })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def move_paddle(request):
    """
    Déplace la raquette du joueur actif
    """
    user = request.user
    serializer = PaddleInputSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    input_value = serializer.validated_data['input']
    match_data = None
    player_number = None
    match_id = None
    
    # Trouver la partie active de l'utilisateur
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
        return Response({
            'error': "L'utilisateur n'est pas dans une partie active"
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Mettre à jour l'état du jeu avec l'entrée
    player_key = f"player{player_number}"
    match_data["game_state"]["inputs"][player_key] = input_value
    
    return Response({
        'status': 'success',
        'input_processed': input_value,
        'player_number': player_number,
        'match_id': match_id
    })