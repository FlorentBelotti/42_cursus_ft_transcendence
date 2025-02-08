from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.http import JsonResponse
import re
import logging

logger = logging.getLogger(__name__)

class AccessControlMiddleware(MiddlewareMixin):
    def process_request(self, request):
        public_urls = [
            r'^/api/token/$',
            r'^/api/users/create/$',
            r'^/home/$',
            r'^/about/$',
            r'^/login/$',
            r'^/register/$',
            r'^/static/.*$',
            r'^/api/users/$', # to delete
        ]

        rank_0_urls = [
            r'^/api/send-verification-code/$',
            r'^/authentication/$',
            r'^/api/verify-code/$',
            r'^/api/token-ranked/$',
        ]

        # Vérifier si l'URL est publique
        for pattern in public_urls:
            if re.match(pattern, request.path):
                logger.info(f"Public URL accessed: {request.path}")
                return

        # Authentifier le token JWT

        token = request.COOKIES.get('access_token')
        if token:
            request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'

        jwt_authenticator = JWTAuthentication()
        try:
            auth_result = jwt_authenticator.authenticate(request)
            if auth_result is None:
                raise AuthenticationFailed('Invalid token')
            user, token = auth_result
            request.user = user
            request.token = token
            logger.info(f"Authenticated user: {user}, token: {token}")
        except AuthenticationFailed:
            logger.warning(f"Authentication failed for URL: {request.path}")
            return JsonResponse({'detail': 'Invalid token 1'}, status=401)

        # Vérifier les permissions basées sur le rang
        for pattern in rank_0_urls:
            if re.match(pattern, request.path):
                if request.token.get('rank') != 0:
                    logger.warning(f"Access denied for URL: {request.path}, rank: {request.token.get('rank')}")
                    return JsonResponse({'detail': 'Access denied 2'}, status=403)
                return

        if request.token.get('rank') not in [1, 2]:
            logger.warning(f"Access denied for URL: {request.path}, rank: {request.token.get('rank')}")
            return JsonResponse({'detail': 'Access denied 3'}, status=403)