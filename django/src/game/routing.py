from django.urls import re_path
from .websockets.matchConsumer import MatchConsumer
from .websockets.tournamentConsumer import TournamentConsumer

websocket_urlpatterns = [
    re_path(r'ws/match/$', MatchConsumer.as_asgi()),
    re_path(r'ws/tournament/$', TournamentConsumer.as_asgi()),
]