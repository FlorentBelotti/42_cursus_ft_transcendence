import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async


class LobbyConsumer(AsyncWebsocketConsumer):
	lobby = []

	async def connect(self):
		self.room_name = "pong_lobby"
		self.room_groupe_name = f"pong{self.room_name}"

		if len(self.lobby) >= 2:
			await self.close()
			return

		self.lobby.append(self.channel_name)

		#Joueur ajouter au groupe WebSocket
		await self.channel_layer.group_add(
			self.room_name,
			self.channel_name
		)
		#Connexion ws accepté
		await self.accept()

		if len(self.lobby) == 2:
			await self.channel_layer.group_send(
				self.room_groupe_name,
				{
					'type': 'start_game',
					'message': 'La partie commence'
				}
			)

	async def disconnect(self, close_code):
		if self.channel_name in self.lobby:
			self.lobby.remove(self.channel_name)
		await self.channel_layer.group_discard(
			self.room_groupe_name,
			self.channel_name
		)
		await self.channel_layer.group_send(
			self.room_groupe_name
			{
				'type':'player_left',
				'message':'Un joueur a quitté le lobby'
			}
		)

	async def start_game(self, event):
		message = event['message']

		await self.send(text_data=json.dumps({
			'message': message
		}))

	async def player_left(self, event):
		message = event['message']

		await self.send(text_data=json.dumps({
			'message': message
		}))
