from rest_framework.response import Response
from django.core.mail import send_mail
from rest_framework import status
from .models import VerificationCode
import logging
from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect
from rest_framework.decorators import api_view
from .models import customUser
from .serializers import UserSerializer, UserDataSerializer
from .forms import RegisterForm
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import AuthenticationForm
from django.conf import settings
import uuid
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from .models import customUser
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages
from .forms import UserUpdateForm, CustomPasswordChangeForm
from django.core.paginator import Paginator

def protected_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Non authentifié"}, status=401)
    
    return JsonResponse({"message": f"Bienvenue, {request.user.username} !"})

# Create
@api_view(['POST'])
def create_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = customUser.objects.create_user(
            username=serializer.validated_data['username'],
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
            elo=1000,
            profile_picture='profile_pictures/arcane_from_arcane.png',
            wins=0,
            losses=0
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

class RefreshTokenView(APIView):
    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh_token')
        
        if not refresh_token:
            return Response({"error": "Refresh token manquant"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)
            
            # Renvoie le nouvel access token
            response = Response({"access_token": access_token}, status=status.HTTP_200_OK)
            response.set_cookie(
                key='access_token',
                value=access_token,
                httponly=True,
                secure=True  # En production uniquement
            )
            return response
            
        except Exception as e:
            return Response({"error": "Refresh token invalide"}, status=status.HTTP_401_UNAUTHORIZED)

def logout_view(request):
    response = redirect('home')
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')
    logout(request)
    return response