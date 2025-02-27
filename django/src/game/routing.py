from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/match/$', consumers.PongConsumer.as_asgi()),
    re_path(r'ws/tournament/$', consumers.TournamentConsumer.as_asgi()),
]