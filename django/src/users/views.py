from django.contrib.auth import get_user_model
from rest_framework.response import Response
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import status
from .models import VerificationCode
import logging
from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect
from rest_framework.decorators import api_view
from .models import customUser
from .serializers import UserSerializer, UserDataSerializer
from .forms import RegisterForm
from django.contrib.auth import login, authenticate
from django.contrib.auth.forms import AuthenticationForm
from django.conf import settings
import uuid

# Create
@api_view(['POST'])
def create_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = customUser.objects.create_user(
            username=serializer.validated_data['username'],
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
            elo=1000
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Read (List)
@api_view(['GET'])
def list_users(request):
    users = customUser.objects.all()
    serializer = UserDataSerializer(users, many=True)
    return Response(serializer.data)

# Read (Detail)
@api_view(['GET'])
def user_detail(request, pk):
    try:
        user = customUser.objects.get(pk=pk)
    except customUser.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    serializer = UserDataSerializer(user)
    return Response(serializer.data)

# Update
@api_view(['PUT'])
def update_user(request, pk):
    try:
        user = customUser.objects.get(pk=pk)
    except customUser.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    serializer = UserSerializer(user, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Delete
@api_view(['DELETE'])
def delete_user(request, pk):
    try:
        user = customUser.objects.get(pk=pk)
    except customUser.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

def logout_action(request):
    if request.method == 'POST':
        response = HttpResponseRedirect('/home/')
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response
    return redirect('logout_page')

def register(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)  # Connecte l'utilisateur après l'inscription
            return redirect("home")  # Redirige vers la page d'accueil
    else:
        form = RegisterForm()
    return render(request, "register.html", {"form": form})

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

                # Redirige vers la page de vérification du code
                return redirect("verify_code", user_id=user.id)
    else:
        form = AuthenticationForm()
    return render(request, "login.html", {"form": form})

def verify_code(request, user_id):
    if request.method == "POST":
        code = request.POST.get('code')
        try:
            verification_code = VerificationCode.objects.get(user_id=user_id, code=code, is_used=False)
            if verification_code.is_expired():
                return render(request, "verify_code.html", {"error": "Le code a expiré."})
            verification_code.is_used = True
            verification_code.save()

            # Connecte l'utilisateur
            user = verification_code.user
            login(request, user)
            return redirect("home")
        except VerificationCode.DoesNotExist:
            return render(request, "verify_code.html", {"error": "Code invalide ou déjà utilisé."})
    return render(request, "verify_code.html")