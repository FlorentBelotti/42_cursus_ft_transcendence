from django.http import JsonResponse
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.contrib.auth.models import AnonymousUser

User = get_user_model()

# /app/src/users/middleware.py
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth.models import AnonymousUser

class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_authenticator = JWTAuthentication()

    def __call__(self, request):
        # Par défaut, pas d'utilisateur authentifié
        request.user = AnonymousUser()

        # Récupérer le access_token depuis le cookie
        access_token = request.COOKIES.get('access_token', None)
        refresh_token = request.COOKIES.get('refresh_token', None)

        if access_token:
            try:
                # Valider le access_token
                validated_token = self.jwt_authenticator.get_validated_token(access_token)
                request.user = self.jwt_authenticator.get_user(validated_token)
            except InvalidToken as e:
                # Si le token est invalide (expiré ou autre), tenter de rafraîchir
                if str(e) == "Token is invalid or expired" and refresh_token:
                    try:
                        # Utiliser le refresh_token pour obtenir un nouveau access_token
                        refresh = RefreshToken(refresh_token)
                        new_access_token = str(refresh.access_token)

                        # Mettre à jour request.user avec le nouveau token
                        validated_token = self.jwt_authenticator.get_validated_token(new_access_token)
                        request.user = self.jwt_authenticator.get_user(validated_token)

                        # Préparer la réponse pour mettre à jour le cookie
                        response = self.get_response(request)
                        response.set_cookie(
                            'access_token',
                            new_access_token,
                            httponly=True,
                            secure=True,
                            samesite='Lax',
                            max_age=3600  # Ajuste selon la durée de vie de ton access_token
                        )
                        return response
                    except TokenError:
                        # Si le refresh_token est invalide ou expiré, laisser AnonymousUser
                        pass
                else:
                    # Autre erreur avec le access_token, pas de rafraîchissement
                    pass
        elif refresh_token:
            # Si pas de access_token mais un refresh_token, tenter de rafraîchir
            try:
                refresh = RefreshToken(refresh_token)
                new_access_token = str(refresh.access_token)

                validated_token = self.jwt_authenticator.get_validated_token(new_access_token)
                request.user = self.jwt_authenticator.get_user(validated_token)

                response = self.get_response(request)
                response.set_cookie(
                    'access_token',
                    new_access_token,
                    httponly=True,
                    secure=True,
                    samesite='Lax',
                    max_age=3600
                )
                return response
            except TokenError:
                pass

        # Continuer le traitement de la requête avec l'utilisateur actuel (authentifié ou non)
        response = self.get_response(request)
        return response
    
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
