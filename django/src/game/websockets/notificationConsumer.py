import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get user from scope - Django Channels has already authenticated the user
        self.user = self.scope["user"]
        
        if not self.user.is_authenticated:
            # Close connection if not authenticated
            print(f"Notification connection rejected: User not authenticated")
            await self.close()
            return
        
        # Set up notification group for this user
        self.user_id = self.user.id
        self.notification_group = f"user_{self.user_id}_notifications"
        
        # Join user-specific notification group
        await self.channel_layer.group_add(
            self.notification_group,
            self.channel_name
        )
        
        # Accept the connection since user is authenticated
        await self.accept()
        print(f"User {self.user.username} (ID: {self.user_id}) connected to notifications in group {self.notification_group}")

    async def disconnect(self, close_code):
        if hasattr(self, 'notification_group'):
            await self.channel_layer.group_discard(
                self.notification_group,
                self.channel_name
            )

    # Handle notification about invitation updates
    async def invitation_update(self, event):
        # Send notification to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'invitation_update',
            'invitation_id': event['invitation_id'],
            'status': event['status']
        }))

    async def invitation_accepted(self, event):
        """Handle notification when an invitation is accepted"""
        await self.send(text_data=json.dumps({
            'type': 'invitation_accepted',
            'invitation_id': event['invitation_id'],
            'game_id': event['game_id'],
            'recipient_username': event['recipient_username'],
            'recipient_nickname': event.get('recipient_nickname')
        }))
    
    async def invitation_declined(self, event):
        """Handle notification when an invitation is declined"""
        await self.send(text_data=json.dumps({
            'type': 'invitation_declined',
            'invitation_id': event['invitation_id'],
            'recipient_username': event['recipient_username']
        }))