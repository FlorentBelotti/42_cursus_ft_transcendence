from channels.generic.websocket import AsyncWebsocketConsumer
import jwt
from channels.db import database_sync_to_async
from django.conf import settings
import json

class BaseGameConsumer(AsyncWebsocketConsumer):
    """
    Base consumer for game functionality with shared authentication and utilities.
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
        Specific cleanup logic is implemented in child classes.
        """
        pass  # Implemented by child classes
    
    async def receive(self, text_data):
        """
        Process incoming WebSocket messages.
        Base implementation handles common messages like authentication.
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type', '')
            
            # Handle authentication if needed
            if message_type == 'authenticate':
                await self.authenticate(data.get('token'))
            else:
                # Child classes will implement specific message handling
                await self.handle_message(data, message_type)
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            await self.send_error(f"Error processing message: {str(e)}")
    
    async def handle_message(self, data, message_type):
        """
        Handle specific message types.
        To be implemented by child classes.
        """
        pass  # Implemented by child classes
    
    async def authenticate(self, token):
        """
        Authenticate the WebSocket connection using JWT token.
        """
        if not token:
            await self.send_error("No authentication token provided")
            await self.close()
            return
        
        user = await self.get_user_from_token(token)
        if not user:
            await self.send_error("Invalid authentication token")
            await self.close()
            return
        
        # Set user on the consumer instance
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
        try:
            from users.models import customUser  # Import here to avoid circular imports
            
            # Decode token
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )
            
            user_id = payload.get('user_id')
            if not user_id:
                return None
            
            # Get user from database
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