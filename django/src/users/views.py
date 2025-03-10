from rest_framework.response import Response
from django.core.mail import send_mail
from rest_framework import status
from .models import VerificationCode
import logging
from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect
from rest_framework.decorators import api_view
from .models import customUser, GameInvitation
from .serializers import UserSerializer, UserDataSerializer
from .forms import RegisterForm
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import AuthenticationForm
from django.conf import settings
import uuid
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages
from .forms import UserUpdateForm, CustomPasswordChangeForm
from django.core.paginator import Paginator
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
            losses=0,
            history=[]
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

@api_view(['GET'])
def online_friends_view(request):
    if request.user.is_authenticated:
        all_friends = request.user.friends.all()
        online_friends = [friend for friend in all_friends if friend.is_online()]
    else:
        online_friends = []

    serializer = UserDataSerializer(online_friends, many=True)
    return Response({
        'online_friends': serializer.data,
        'count': len(online_friends)
    })

@login_required
def get_user_invitations(request):
    """
    Get all game invitations for the current user.
    """
    print(f"API Invitations: Getting invitations for {request.user.username}")
    
    # Expire old pending invitations first
    pending_invitations = GameInvitation.objects.filter(recipient=request.user, status='pending')
    for invitation in pending_invitations:
        invitation.expire_if_needed()
    
    # Get active pending invitations
    active_invitations = GameInvitation.objects.filter(
        recipient=request.user, 
        status='pending'
    ).select_related('sender').order_by('-created_at')
    
    invitations_data = []
    for invitation in active_invitations:
        sender = invitation.sender
        invitations_data.append({
            'id': invitation.id,
            'sender_username': sender.username,
            'sender_display': sender.nickname or sender.username,
            'sender_profile_pic': sender.profile_picture.url if sender.profile_picture else None,
            'match_type': invitation.match_type,
            'match_type_display': dict(GameInvitation.MATCH_TYPES).get(invitation.match_type, "Match"),
            'created_at': invitation.created_at.isoformat(),
            'expires_at': invitation.expires_at.isoformat(),
            'time_remaining': int((invitation.expires_at - timezone.now()).total_seconds())
        })
    
    return JsonResponse({
        'invitations': invitations_data
    })

@login_required
def respond_to_invitation(request, invitation_id):
    """
    Respond to a game invitation (accept or decline).
    """
    try:
        invitation = GameInvitation.objects.get(id=invitation_id, recipient=request.user)
        
        # Check if expired
        if invitation.expire_if_needed():
            return JsonResponse({'success': False, 'message': 'Cette invitation a expiré'})
        
        action = request.data.get('action', '') if hasattr(request, 'data') else request.POST.get('action', '')
        if action not in ['accept', 'decline']:
            return JsonResponse({'success': False, 'message': 'Action invalide'})
        
        # Update status
        invitation.status = action + 'ed'  # 'accepted' or 'declined'
        invitation.save()
        
        if action == 'accept':
            return JsonResponse({
                'success': True,
                'message': 'Invitation acceptée',
                'redirect': f'/match/?invitation={invitation.id}' if invitation.match_type == 'regular' else f'/tournament/?invitation={invitation.id}',
                'match_type': invitation.match_type
            })
        else:
            return JsonResponse({'success': True, 'message': 'Invitation refusée'})
            
    except GameInvitation.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invitation introuvable'})