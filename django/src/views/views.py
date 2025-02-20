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
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import AuthenticationForm
from django.urls import reverse

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
from users.forms import UserUpdateForm, CustomPasswordChangeForm

def check_auth_status(request):
    return JsonResponse({
        'is_authenticated': request.user.is_authenticated,
        'urls': {
            'account': reverse('account'),
            'register': reverse('register'),
            'login': reverse('login')
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

@login_required
def account(request):
    if request.method == "POST":
        try:
            user_form = UserUpdateForm(request.POST, request.FILES, instance=request.user)
            
            if 'update_info' in request.POST:
                if user_form.is_valid():
                    user_form.save()
                    return JsonResponse({
                        "success": "User's details updated"
                    }, status=200)
                else:
                    return JsonResponse({
                        "error": "Validation failed",
                        "errors": user_form.errors
                    }, status=400)
            
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
        password_form = CustomPasswordChangeForm(request.user)

    return define_render(request, {
        'user_form': user_form,
        'password_form': password_form
    })

def register(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({"success": "User registered"}, status=201)
        else:
            return JsonResponse({"error": "User failed to register"}, status=401)
    else:
        form = RegisterForm()
        return define_render(request, {'form': form})
    
def user_login(request):
    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                code = str(uuid.uuid4())
                VerificationCode.objects.create(user=user, code=code)

                send_mail(
                    'Votre code de vérification',
                    f'Votre code de vérification est : {code}',
                    settings.EMAIL_HOST_USER,
                    [user.email],
                    fail_silently=False,
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
        form = AuthenticationForm()
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