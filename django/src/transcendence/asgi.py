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
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from django.urls import re_path
from game.routing import websocket_urlpatterns

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "transcendence.settings")


application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(websocket_urlpatterns),

})
