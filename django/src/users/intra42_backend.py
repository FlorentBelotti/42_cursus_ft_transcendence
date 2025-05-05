from social_core.backends.oauth import BaseOAuth2
from base64 import b64encode
from social_core.exceptions import AuthFailed

class Intra42OAuth2(BaseOAuth2):
	name = 'intra42'
	AUTHORIZATION_URL = 'https://api.intra.42.fr/oauth/authorize'
	ACCESS_TOKEN_URL = 'https://api.intra.42.fr/oauth/token'
	ACCESS_TOKEN_METHOD = 'POST'
	REFRESH_TOKEN_URL = 'https://api.intra.42.fr/oauth/token'
	SCOPE_SEPARATOR = ' '
	EXTRA_DATA = [
		('refresh_token', 'refresh_token', True),
		('expires_in', 'expires'),
		('scope', 'scope')
	]

	def auth_headers(self):
		credentials = f"{self.setting('KEY')}:{self.setting('SECRET')}"
		encoded_credentials = b64encode(credentials.encode()).decode()
		return {
			'Authorization': f'Basic {encoded_credentials}'
		}

	def get_user_details(self, response):
		return {
			'username': response.get('login'),
			'email': response.get('email'),
			'first_name': response.get('first_name'),
			'last_name': response.get('last_name')
		}

	def user_data(self, access_token, *args, **kwargs):
		try:
			return self.get_json('https://api.intra.42.fr/v2/me', headers={
				'Authorization': f'Bearer {access_token}'
			})
		except Exception as e:
			raise AuthFailed(self, f"Erreur lors de la récupération des données utilisateur: {str(e)}")
	
	def auth_complete(self, *args, **kwargs):
		"""Complète le processus d'authentification et gère les erreurs"""
		try:
			# Tentative d'authentification standard
			return super().auth_complete(*args, **kwargs)
		except AuthFailed as e:
			# Authentification échouée (refus utilisateur ou problème API)
			if 'error' in self.data:
				error = self.data.get('error')
				if error == 'access_denied':
					# L'utilisateur a refusé l'autorisation
					raise AuthFailed(self, "L'utilisateur a refusé l'autorisation")
			# Autres erreurs d'authentification
			raise
