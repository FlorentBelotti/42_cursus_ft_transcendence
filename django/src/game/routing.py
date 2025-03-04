from django.urls import re_path
from .websockets.pongMatchConsumer import MatchConsumer
from .websockets.pongTournamentConsumer import TournamentConsumer

websocket_urlpatterns = [
    re_path(r'ws/match/$', MatchConsumer.as_asgi()),
    re_path(r'ws/tournament/$', TournamentConsumer.as_asgi()),
]