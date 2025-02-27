from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from users.models import customUser
import jwt

class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Try to get JWT from query string or cookies
        query_params = dict((x.split('=') for x in scope['query_string'].decode().split('&') if x))
        token = query_params.get('token', None)
        
        # Get headers (WebSocket doesn't have easy cookie access like HTTP)
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
        try:
            access_token = AccessToken(token)
            user_id = access_token.payload.get('user_id')
            return customUser.objects.get(id=user_id)
        except customUser.DoesNotExist:
            return None