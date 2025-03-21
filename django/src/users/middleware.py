from django.http import JsonResponse
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from django.contrib.auth import get_user_model

User = get_user_model()

class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        access_token = request.COOKIES.get('access_token') or request.headers.get('Authorization', '').split('Bearer ')[-1]
        refresh_token = request.COOKIES.get('refresh_token')
        
        if access_token:
            try:
                token = AccessToken(access_token)
                user_id = token.payload.get('user_id')
                user = User.objects.get(id=user_id)
                request.user = user  # Attache l'utilisateur à la requête
                
            except (TokenError, InvalidToken, User.DoesNotExist) as e:
                # Si le token est expiré, tente de le rafraîchir
                if refresh_token:
                    try:
                        refresh = RefreshToken(refresh_token)
                        new_access_token = str(refresh.access_token)
                        
                        # Met à jour le cookie avec le nouvel access token
                        response = self.get_response(request)
                        response.set_cookie(
                            key='access_token',
                            value=new_access_token,
                            httponly=True,
                            secure=True
                        )
                        return response
                        
                    except (TokenError, InvalidToken) as e:
                        return JsonResponse({"error": "Token invalide"}, status=401)
                
                return JsonResponse({"error": "Token invalide"}, status=401)
        
        return self.get_response(request)
    
from django.utils import timezone
from django.contrib.auth import get_user_model

class UpdateLastSeenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            user = request.user
            user.update_last_seen()

        response = self.get_response(request)
        return response
