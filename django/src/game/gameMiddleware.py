from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from users.models import customUser
import jwt

class JWTAuthMiddleware(BaseMiddleware):

    """
    ╔═══════════════════════════════════════════════════╗
    ║            JWTAuthMiddleware                      ║
    ╠═══════════════════════════════════════════════════╣
    ║ Authentication middleware for WebSocket consumers ║
    ║                                                   ║
    ║ • Extracts JWT from query params or cookies       ║
    ║ • Validates tokens and handles auth errors        ║
    ║ • Attaches user objects to WebSocket scope        ║
    ║ • Enables authenticated WebSocket connections     ║
    ╚═══════════════════════════════════════════════════╝
    """

    async def __call__(self, scope, receive, send):
        """
        Process WebSocket connection with JWT authentication.

        Extracts JWT token from query parameters or cookies, validates it,
        and attaches the corresponding user to the connection scope.
        Falls back to AnonymousUser if authentication fails.
        """

        # Try to get JWT from strings or cookies
        query_params = dict((x.split('=') for x in scope['query_string'].decode().split('&') if x))
        token = query_params.get('token', None)
        
        # Get headers
        headers = dict(scope['headers'])
        if b'cookie' in headers:
            cookies = headers[b'cookie'].decode()
            for cookie in cookies.split('; '):
                if cookie.startswith('access_token='):
                    token = cookie.split('=')[1]
        
        scope['user'] = AnonymousUser()
        
        if token:
            try:
                user = await self.get_user_from_token(token)
                if user:
                    scope['user'] = user
            except (InvalidToken, TokenError, jwt.PyJWTError):
                pass
        
        return await super().__call__(scope, receive, send)
    
    @database_sync_to_async
    def get_user_from_token(self, token):
        """
        Validate JWT token and retrieve associated user.

        Decodes and validates the provided JWT access token,
        then retrieves the corresponding user from the database.
        """
        
        try:
            access_token = AccessToken(token)
            user_id = access_token.payload.get('user_id')
            return customUser.objects.get(id=user_id)
        except customUser.DoesNotExist:
            return None