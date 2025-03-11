from django.urls import re_path
from .websockets.pongMatchConsumer import MatchConsumer
from .websockets.pongTournamentConsumer import TournamentConsumer
from .websockets.notificationConsumer import NotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/match/$', MatchConsumer.as_asgi()),
    re_path(r'ws/tournament/$', TournamentConsumer.as_asgi()),
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
]