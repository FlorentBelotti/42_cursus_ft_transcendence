from channels.generic.websocket import AsyncWebsocketConsumer
import jwt
from channels.db import database_sync_to_async
from django.conf import settings
import json

class BaseGameConsumer(AsyncWebsocketConsumer):
    """
    ╔═══════════════════════════════════════════════════╗
    ║               BaseGameConsumer                    ║
    ╠═══════════════════════════════════════════════════╣
    ║ WebSocket base class for Pong game communication  ║
    ║                                                   ║
    ║ • Handles JWT authentication                      ║
    ║ • Provides error handling                         ║
    ║ • Implements message formatting                   ║
    ║ • Parent class for all game WebSocket consumers   ║
    ╚═══════════════════════════════════════════════════╝
    """
    
    async def connect(self):
        """
        Handle WebSocket connection, accepting all connections initially.
        Authentication happens after connection is established.
        """
        await self.accept()
    
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        Child classes implementation.
        """
        pass 
    
    async def receive(self, text_data):
        """
        Process incoming WebSocket messages.
        Child classes implementation.
        """

        # Authentication process
        try:
            data = json.loads(text_data)
            message_type = data.get('type', '')
            if message_type == 'authenticate':
                await self.authenticate(data.get('token'))
            else:
                await self.handle_message(data, message_type)

        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            await self.send_error(f"Error processing message: {str(e)}")
    
    async def handle_message(self, data, message_type):
        """
        Handle specific message types.
        Child classes implementation.
        """

        pass
    
    async def authenticate(self, token):
        """
        Authenticate the WebSocket connection using JWT token.
        """

        # Authentication process
        if not token:
            await self.send_error("No authentication token provided")
            await self.close()
            return
        user = await self.get_user_from_token(token)
        if not user:
            await self.send_error("Invalid authentication token")
            await self.close()
            return
        
        # Set user's consumer instance
        self.user = user
        await self.send(text_data=json.dumps({
            "type": "authenticated",
            "username": self.user.username,
            "elo": self.user.elo
        }))
    
    @database_sync_to_async
    def get_user_from_token(self, token):
        """
        Validate JWT token and return the corresponding user.
        """
        
        # Authentication process
        try:
            from users.models import customUser
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )
            user_id = payload.get('user_id')
            if not user_id:
                return None
            
            # Retreive user from database
            return customUser.objects.filter(id=user_id).first()
            
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except Exception:
            return None
    
    async def send_error(self, message):
        """
        Send error message to client.
        """
        await self.send(text_data=json.dumps({
            "type": "error",
            "message": message
        }))
        
    async def send_message(self, message_type, data):
        """
        Send a formatted message to the client.
        """
        message = {"type": message_type}
        message.update(data)
        await self.send(text_data=json.dumps(message))