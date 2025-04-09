from social_core.backends.oauth import BaseOAuth2

from base64 import b64encode

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
        """Retourne les en-têtes d'authentification."""
        credentials = f"{self.setting('KEY')}:{self.setting('SECRET')}"
        encoded_credentials = b64encode(credentials.encode()).decode()
        return {
            'Authorization': f'Basic {encoded_credentials}'
        }

    def get_user_details(self, response):
        """Return user details from 42 account"""
        return {
            'username': response.get('login'),
            'email': response.get('email'),
            'first_name': response.get('first_name'),
            'last_name': response.get('last_name')
        }

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        return self.get_json('https://api.intra.42.fr/v2/me', headers={
            'Authorization': f'Bearer {access_token}'
        })