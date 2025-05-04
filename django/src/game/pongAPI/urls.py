from django.urls import path
from . import api_views

urlpatterns = [
    # Endpoints API pour le jeu Pong
    path('api/pong/status/', api_views.game_status, name='pong_game_status'),
    path('api/pong/score/', api_views.game_score, name='pong_game_score'),
    path('api/pong/matchmaking/', api_views.start_matchmaking, name='pong_start_matchmaking'),
    path('api/pong/paddle/', api_views.move_paddle, name='pong_move_paddle'),
]