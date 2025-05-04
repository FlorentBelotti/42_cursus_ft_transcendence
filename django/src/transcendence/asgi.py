import os
import django
from django.core.asgi import get_asgi_application

# Set up Django first
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'transcendence.settings')
django.setup()

# Import other components only AFTER Django is set up
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.sessions import SessionMiddlewareStack
from game.routing import websocket_urlpatterns
from game.gameMiddleware import JWTAuthMiddleware

application = ProtocolTypeRouter({
	"http": get_asgi_application(),
	"websocket": JWTAuthMiddleware(
		AuthMiddlewareStack(
			SessionMiddlewareStack(
				URLRouter(websocket_urlpatterns)
			)
		)
	),
})