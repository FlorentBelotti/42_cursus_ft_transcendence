import jwt
import uuid
import logging
import json

from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.core.exceptions import ValidationError, PermissionDenied
from django.db.utils import DatabaseError
from django.conf import settings
from django.shortcuts import render, redirect
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.contrib.auth import update_session_auth_hash
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate, logout, get_user_model
from django.contrib.auth.forms import AuthenticationForm
from django.urls import reverse
from django.template.loader import render_to_string

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework import status

from users.models import VerificationCode
from users.models import customUser
from users.serializers import UserSerializer, UserDataSerializer
from users.forms import RegisterForm
from users.models import customUser
from users.forms import UserUpdateForm, CustomPasswordChangeForm, NicknameUpdateForm
from users.forms import CustomLoginForm


def check_auth_status(request):
    return JsonResponse({
        'is_authenticated': request.user.is_authenticated,
        'urls': {
            'account': reverse('account'),
            'register': reverse('register'),
            'login': reverse('login'),
            'friends': reverse('friends'),
            'leaderboard': reverse('leaderboard'),
            'snake': reverse('snake'),
        }
    })

def define_render(request, additional_context=None):
    template_name = request.path[1:].rstrip('/') + '.html'

    context = {
        'content_template': template_name,
    }

    if additional_context:
        context.update(additional_context)
        if "user_id" in additional_context:
            request.path += '2/'

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, template_name, context)
    else:
        return render(request, 'base.html', context)

def leaderboard(request):
    User = get_user_model()
    users = User.objects.all().order_by('-elo')

    # Get the current user's history if they're logged in
    user_history = []
    if request.user.is_authenticated:
        user_history = request.user.history if hasattr(request.user, 'history') else []

        # Sort history by timestamp (newest first)
        if user_history:
            user_history = sorted(user_history, key=lambda x: x.get('timestamp', ''), reverse=True)

            # Add opponent profile picture URLs
            enhanced_history = []
            for match in user_history:
                match_copy = match.copy()
                if 'opponent_username' in match:
                    try:
                        opponent = User.objects.get(username=match['opponent_username'])
                        if opponent.profile_picture:
                            match_copy['opponent_picture_url'] = opponent.profile_picture.url
                    except User.DoesNotExist:
                        pass
                enhanced_history.append(match_copy)

            user_history = enhanced_history
    return define_render(request, {
        'users': users,
        'user_history': user_history
    })

@login_required
def account(request):
    if request.method == "POST":
        try:
            user_form = UserUpdateForm(request.POST, request.FILES, instance=request.user)
            password_form = CustomPasswordChangeForm(request.user, request.POST)
            nickname_form = NicknameUpdateForm(request.POST, instance=request.user)

            if 'update_info' in request.POST:
                if user_form.is_valid():
                    user_form.save()
                    return JsonResponse({ "success": "User's details updated"}, status=200)
                else:
                    return JsonResponse({
                        "error": "User's details validation failed",
                        "errors": user_form.errors
                    }, status=400)

            elif 'change_password' in request.POST:
                if password_form.is_valid():
                    password_form.save()
                    update_session_auth_hash(request, request.user)
                    return JsonResponse({"success": "User's password updated"}, status=200)
                else:
                    return JsonResponse({
                        "error": "Password validation failed",
                        "errors": password_form.errors
                    }, status=400)

            elif 'delete_account' in request.POST:
                response = JsonResponse({
                    "success": "Account deleted",
                }, status=200)
                response.delete_cookie('access_token')
                response.delete_cookie('refresh_token')
                response.delete_cookie('sessionid')
                request.user.delete()
                return response

            elif 'update_nickname' in request.POST:
                if nickname_form.is_valid():
                    nickname_form.save()
                    return JsonResponse({"success": "Nickname updated"}, status=200)
                else:
                    return JsonResponse({
                        "error": "Nickname validation failed",
                        "errors": nickname_form.errors
                    }, status=400)

            elif 'disconnect' in request.POST:
                response = JsonResponse({
                    "success": "User disconnected",
                }, status=200)
                response.delete_cookie('access_token')
                response.delete_cookie('refresh_token')
                return response

            return JsonResponse({
                "error": "Invalid action"
            }, status=400)

        except Exception as e:
            return JsonResponse({
                "error": "Server error",
                "message": str(e)
            }, status=500)

    else:
        user_form = UserUpdateForm(instance=request.user)
        nickname_form = NicknameUpdateForm(instance=request.user)
        password_form = CustomPasswordChangeForm(request.user)

    return define_render(request, {
        'user_form': user_form,
        'password_form': password_form,
        'nickname_form': nickname_form
    })

def register(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({"success": "User registered"}, status=201)
        else:
            return JsonResponse({
                "error": "User failed to register",
                "errors": form.errors
            }, status=400)
    else:
        form = RegisterForm()
        return define_render(request, {'form': form})

def user_login(request):
    if request.method == "POST":
        form = CustomLoginForm(request, data=request.POST)  # Utilisez CustomLoginForm ici
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                code = str(uuid.uuid4())
                VerificationCode.objects.create(user=user, code=code)

                html_message = render_to_string('verification_email.html', {'verification_code': code})
                plain_message = f'Votre code de vérification est : {code}'

                send_mail(
                    'Votre code de vérification',
                    plain_message,
                    settings.EMAIL_HOST_USER,
                    [user.email],
                    fail_silently=False,
                    html_message=html_message,
                )
                return JsonResponse({
                    "success": "User logged in",
                    "user_id": user.id
                }, status=201)
            else:
                return JsonResponse({"error": "User does not exist"}, status=400)
        else:
            return JsonResponse({"error": "Wrong username or password"}, status=400)
    else:
        form = CustomLoginForm()  # Utilisez CustomLoginForm ici aussi
        return define_render(request, {'form': form})

def verify_code(request, user_id):
    if request.method == "POST":
        try:
            code = request.POST.get('code')
            if not code:
                return JsonResponse({"error": "Code is required"}, status=400)

            verification_code = VerificationCode.objects.get(
                user_id=user_id,
                code=code,
                is_used=False
            )

            if verification_code.is_expired():
                return JsonResponse({"error": "Code expired"}, status=401)

            verification_code.is_used = True
            verification_code.save()

            user = verification_code.user
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            response = JsonResponse({
                "success": "Code verified successfully",
                "redirect_url": "/home/"
            })

            cookie_params = {
                'httponly': True,
                'secure': True,
                'samesite': 'Strict'
            }

            response.set_cookie(
                key='access_token',
                value=access_token,
                **cookie_params
            )

            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                **cookie_params
            )

            return response

        except VerificationCode.DoesNotExist:
            return JsonResponse({"error": "Wrong authentication code"}, status=401)

        except ValidationError as e:
            return JsonResponse({"error": "Wrong authentication code"}, status=401)

        except PermissionDenied as e:
            return JsonResponse({"error": "Permission denied"}, status=403)

        except DatabaseError as e:
            logger.error(f"Database error in verify_code: {str(e)}")
            return JsonResponse({"error": "Internal server error"}, status=500)

        except Exception as e:
            logger.error(f"Unexpected error in verify_code: {str(e)}")
            return JsonResponse({"error": "Internal server error"}, status=500)

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, "verify_code.html")
    else:
        return render(request, 'base.html', {
            'content_template': 'verify_code.html'
        })

@login_required
def friends_view(request):
    if request.method == "POST":
        username = request.POST.get('username')
        try:
            friend = customUser.objects.get(username=username)
            if friend != request.user:
                request.user.friends.add(friend)
                messages.success(request, f'{username} a été ajouté à votre liste d\'amis.')
            else:
                messages.error(request, 'Vous ne pouvez pas vous ajouter vous-même.')
        except customUser.DoesNotExist:
            messages.error(request, 'Utilisateur non trouvé.')

    friends = request.user.friends.all()
    return define_render(request, {'friends': friends})