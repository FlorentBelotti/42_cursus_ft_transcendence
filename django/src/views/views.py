from django.shortcuts import render
import jwt
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
import logging
from django.shortcuts import render, redirect
from django.http import HttpResponse

from rest_framework.response import Response
from django.core.mail import send_mail
from rest_framework import status
from users.models import VerificationCode
import logging
from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect
from rest_framework.decorators import api_view
from users.models import customUser
from users.serializers import UserSerializer, UserDataSerializer
from users.forms import RegisterForm
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import AuthenticationForm
from django.conf import settings
import uuid
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from users.models import customUser
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages
from users.forms import UserUpdateForm, CustomPasswordChangeForm
from django.core.paginator import Paginator

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
                # Génère un code de vérification
                code = str(uuid.uuid4())
                VerificationCode.objects.create(user=user, code=code)

                # Envoie le code par email
                send_mail(
                    'Votre code de vérification',
                    f'Votre code de vérification est : {code}',
                    settings.EMAIL_HOST_USER,
                    [user.email],
                    fail_silently=False,
                )
                return JsonResponse({
                    "success": "User logged in",
                    "user_id": user.id  # Inclure l'user_id dans la réponse
                }, status=201)
        else:
            return JsonResponse({"error": "User failed to log in"}, status=401)
    else:
        form = AuthenticationForm()
        return define_render(request, {'form': form})


def verify_code(request, user_id):
    if request.method == "POST":
        code = request.POST.get('code')
        try:
            verification_code = VerificationCode.objects.get(user_id=user_id, code=code, is_used=False)
            
            if verification_code.is_expired():
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
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

            response.set_cookie(
                key='access_token',
                value=access_token,
                httponly=True,
                secure=True,  
                samesite='Strict'  
            )
            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                httponly=True,
                secure=True,  
                samesite='Strict'  
            )

            return response
            
        except VerificationCode.DoesNotExist:
            return JsonResponse({"error": "Invalid code"}, status=401)

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, "verify_code.html")
    else:
        return render(request, 'base.html', {
            'content_template': 'verify_code.html'
        })