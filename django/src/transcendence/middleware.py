from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.http import JsonResponse

class JWTAuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request):
        jwt_authenticator = JWTAuthentication()
        try:
            user, token = jwt_authenticator.authenticate(request)
            request.user = user
            request.token = token
        except AuthenticationFailed:
            request.user = None
            request.token = None

class TwoFactorAuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if request.user and request.user.is_authenticated:
            if not request.session.get('is_verified'):
                return JsonResponse({'detail': 'Two-factor authentication required'}, status=403)