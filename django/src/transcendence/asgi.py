# import os
# from django.core.asgi import get_asgi_application
# from channels.routing import ProtocolTypeRouter, URLRouter
# import pong.routing  # Fichier où on va définir les routes WebSocket

# os.environ.setdefault("DJANGO_SETTINGS_MODULE", "transcendence.settings")

# application = ProtocolTypeRouter({
#     "http": get_asgi_application(),  # Gérer les requêtes HTTP classiques
#     "websocket": URLRouter(pong.routing.websocket_urlpatterns),  # Gérer les WebSockets
# })

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
import game.routing
from django.urls import re_path
from game import consumers

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "transcendence.settings")


application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(game.routing.websocket_urlpatterns),

})
