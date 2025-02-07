# filepath: /home/theo/Documents/GitHub/ft_transcendence/django/src/transcendence/middleware.py
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.http import JsonResponse

class AccessControlMiddleware(MiddlewareMixin):
    def process_request(self, request):
        public_urls = [
            '/api/token/',
        ]

        rank_0_urls = [
            '/api/send-verification-code/',
            '/api/verify-code/',
        ]

        if request.path in public_urls:
            return

        jwt_authenticator = JWTAuthentication()
        try:
            user, token = jwt_authenticator.authenticate(request)
            request.user = user
            request.token = token
        except AuthenticationFailed:
            return JsonResponse({'detail': 'Invalid token'}, status=401)

        if request.path in rank_0_urls:
            if request.token.get('rank') != 0:
                return JsonResponse({'detail': 'Access denied'}, status=403)
        else:
            if request.token.get('rank') not in [1, 2]:
                return JsonResponse({'detail': 'Access denied'}, status=403)