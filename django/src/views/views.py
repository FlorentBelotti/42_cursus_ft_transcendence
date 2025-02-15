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

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, template_name, context)
    else:
        return render(request, 'base.html', context)

def register(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            form.save()
            request.path = '/home/'
            return define_render(request)
        else:
            return define_render(request, {'form': form})
    else:
        form = RegisterForm()
        return define_render(request, {'form': form})