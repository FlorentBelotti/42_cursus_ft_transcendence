from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
import jwt
from django.conf import settings
from users.models import customUser

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        access_token = request.COOKIES.get('access_token')
        if not access_token:
            return None

        try:
            payload = jwt.decode(
                access_token,
                settings.SECRET_KEY,
                algorithms=["HS256"]
            )
            user_id = payload.get('user_id')
            user = customUser.objects.get(id=user_id)
            return (user, access_token)
        except (jwt.InvalidTokenError, customUser.DoesNotExist):
            raise AuthenticationFailed('Token invalide ou utilisateur non trouvé')
