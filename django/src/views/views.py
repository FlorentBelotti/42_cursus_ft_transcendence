from django.shortcuts import render
import jwt
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
import logging
from django.shortcuts import render, redirect
from django.http import HttpResponse

logger = logging.getLogger(__name__)

def get_user_rank_from_token(request):

    # Récupérer le token JWT du cookie
    token = request.COOKIES.get('access_token')
    if not token:
        logger.warning("No token found in cookies")
        return None

    # Ajouter le token dans les en-têtes d'autorisation pour JWTAuthentication
    request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'

    # Valider le token avec JWTAuthentication
    jwt_authenticator = JWTAuthentication()
    try:
        auth_result = jwt_authenticator.authenticate(request)
        if auth_result is None:
            logger.warning("Invalid token: Authentication result is None")
            raise AuthenticationFailed('Invalid token')

        # Extraire l'utilisateur et le token
        user, token = auth_result
        logger.info(f"Authenticated user: {user}, token: {token}")

        # Retourner le rank de l'utilisateur
        rank = token.get('rank')
        if rank is None:
            logger.warning("No rank found in token payload")
            return None

        return rank

    except AuthenticationFailed as e:
        logger.warning(f"Authentication failed: {str(e)}")
        return None

def define_render(request):
    template_name = request.path[1:].rstrip('/') + '.html'
    rank = get_user_rank_from_token(request)

    context = {
        'content_template': template_name,
        'rank': rank
    }

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, template_name)
    else:
        return render(request, 'base.html', context)
