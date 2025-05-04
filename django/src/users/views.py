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
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json
import time
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework import status

from views.views import define_render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework import status

def protected_view(request):
	if not request.user.is_authenticated:
		return JsonResponse({"error": "Non authentifié"}, status=401)

	return JsonResponse({"message": f"Bienvenue, {request.user.username} !"})

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

@api_view(['GET'])
def list_users(request):
	users = customUser.objects.all()
	serializer = UserDataSerializer(users, many=True)
	return Response(serializer.data)

@api_view(['GET'])
def user_detail(request, pk):
	try:
		user = customUser.objects.get(pk=pk)
	except customUser.DoesNotExist:
		return Response(status=status.HTTP_404_NOT_FOUND)
	serializer = UserDataSerializer(user)
	return Response(serializer.data)

@api_view(['GET'])
def user_me_detail(request):
	token = request.COOKIES.get('access_token', '')

	try:
		validated_token = AccessToken(token)
		user_id = validated_token['user_id']
		user = customUser.objects.get(id=user_id)

		serializer = UserDataSerializer(user)

		response_data = serializer.data
		response_data['is_online'] = user.is_online()

		return Response({
			'user': response_data,
			'status': 'success'
		}, status=status.HTTP_200_OK)

	except Exception as e:
		return Response({
			'user': None,
			'status': 'error',
			'error': str(e)
		}, status=status.HTTP_401_UNAUTHORIZED)

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

@api_view(['DELETE'])
def delete_user(request, pk):
	try:
		user = customUser.objects.get(pk=pk)
	except customUser.DoesNotExist:
		return Response(status=status.HTTP_404_NOT_FOUND)
	user.delete()
	return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
def logout_action(request):
	if request.method == 'POST':
		response = HttpResponseRedirect('/home/')
		response.delete_cookie('sessionid')
		response.delete_cookie('access_token')
		response.delete_cookie('refresh_token')
		return response
	return redirect('home')


class RefreshTokenView(APIView):
	def post(self, request):
		refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh_token')

		if not refresh_token:
			return Response({"error": "Refresh token manquant"}, status=status.HTTP_400_BAD_REQUEST)

		try:
			refresh = RefreshToken(refresh_token)
			access_token = str(refresh.access_token)

			response = Response({"access_token": access_token}, status=status.HTTP_200_OK)
			response.set_cookie(
				key='access_token',
				value=access_token,
				httponly=True,
				secure=True,
				samesite='Lax'
			)
			return response

		except Exception as e:
			return Response({"error": "Refresh token invalide"}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET'])
def online_friends_view(request):
	token = request.COOKIES.get('access_token', '')

	try:
		validated_token = AccessToken(token)
		user_id = validated_token['user_id']
		user = customUser.objects.get(id=user_id)

		all_friends = user.friends.all()
		online_friends = [friend for friend in all_friends if friend.is_online()]

		serializer = UserDataSerializer(online_friends, many=True)
		return Response({
			'online_friends': serializer.data,
			'count': len(online_friends)
		}, status=status.HTTP_200_OK)

	except Exception as e:
		return Response({
			'online_friends': [],
			'count': 0,
			'error': str(e)
		}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
def friends_view(request):
	token = request.COOKIES.get('access_token', '')

	try:
		validated_token = AccessToken(token)
		user_id = validated_token['user_id']
		user = customUser.objects.get(id=user_id)

		all_friends = user.friends.all()

		serializer = UserDataSerializer(all_friends, many=True)
		return Response({
			'friends': serializer.data,
			'count': len(all_friends)
		}, status=status.HTTP_200_OK)

	except Exception as e:
		return Response({
			'friends': [],
			'count': 0,
			'error': str(e)
		}, status=status.HTTP_401_UNAUTHORIZED)

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.http import JsonResponse
from users.models import customUser

def password_reset_request(request):
	if request.method == "POST":
		email = request.POST.get('email')
		if not email:
			return JsonResponse({"error": "Email requis"}, status=400)

		try:
			user = customUser.objects.get(email=email)
			token = default_token_generator.make_token(user)
			uid = urlsafe_base64_encode(force_bytes(user.pk))

			reset_link = f"{request.scheme}://{request.get_host()}/password_reset_confirm/{uid}/{token}/"

			html_message = render_to_string('password_reset_email.html', {
				'reset_link': reset_link,
				'user': user,
			})
			plain_message = f"Voici votre lien pour réinitialiser votre mot de passe : {reset_link}"

			send_mail(
				'Réinitialisation de mot de passe',
				plain_message,
				settings.EMAIL_HOST_USER,
				[user.email],
				fail_silently=False,
				html_message=html_message,
			)

			return JsonResponse({"success": "Lien envoyé à votre email"}, status=200)

		except customUser.DoesNotExist:
			return JsonResponse({"success": "Si l'email existe, un lien a été envoyé"}, status=200)

		except Exception as e:
			logger.error(f"Erreur dans password_reset_request : {str(e)}")
			return JsonResponse({"error": "Erreur interne"}, status=500)

	return define_render(request, {'content_template': 'password_reset_request.html'})

def password_reset_confirm(request, uidb64, token):
	try:
		uid = force_str(urlsafe_base64_decode(uidb64))
		user = customUser.objects.get(pk=uid)
	except (TypeError, ValueError, OverflowError, customUser.DoesNotExist):
		user = None

	if user is not None and default_token_generator.check_token(user, token):
		if request.method == "POST":
			new_password = request.POST.get('new_password')
			if not new_password:
				return JsonResponse({"error": "Nouveau mot de passe requis"}, status=400)

			user.set_password(new_password)
			user.save()
			return JsonResponse({
				"success": "Mot de passe réinitialisé avec succès",
				"redirect_url": "/login/"
			}, status=200)

		return define_render(request, {'content_template': 'password_reset_confirm.html'})
	else:
		return JsonResponse({"error": "Lien invalide ou expiré"}, status=400)



from django.http import HttpResponseRedirect
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.decorators import login_required
import logging

logger = logging.getLogger(__name__)

@login_required
def post_login(request):
	logger.info(f"Requête reçue pour /api/post-login/ par {request.user}")

	access_token = request.COOKIES.get('access_token')
	refresh_token = request.COOKIES.get('refresh_token')

	if not access_token or not refresh_token:
		user = request.user
		logger.info(f"Utilisateur authentifié : {user}, génération des tokens")
		refresh = RefreshToken.for_user(user)
		access_token = str(refresh.access_token)
		refresh_token = str(refresh)

		response = HttpResponseRedirect('/home/')
		response.set_cookie('access_token', access_token, httponly=True, secure=True, samesite='Strict')
		response.set_cookie('refresh_token', refresh_token, httponly=True, secure=True, samesite='Strict')
		logger.info(f"Tokens générés - Access: {access_token[:10]}..., Refresh: {refresh_token[:10]}...")
		logger.info("Cookies définis, redirection vers /home/")
		return response

	logger.info("Tokens déjà présents, redirection vers /home/")
	return HttpResponseRedirect('/home/')

########################################################################################################################################
########################################################################################################################################
########################################################################################################################################
##                          PONG API                                                                                                 ###
########################################################################################################################################
########################################################################################################################################
########################################################################################################################################
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth.models import AnonymousUser
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from users.models import customUser
import jwt

class MatchSearchAPIView(APIView):
    """
    API endpoint to initiate matchmaking or join an invited game.
    Requires JWT authentication via access_token cookie.
    """
    def post(self, request):
        # Extract and validate JWT from cookie
        token = request.COOKIES.get('access_token')
        if not token:
            return Response({"error": "Authentication token not provided"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            access_token = AccessToken(token)
            user_id = access_token.payload.get('user_id')
            user = customUser.objects.get(id=user_id)
        except (InvalidToken, TokenError, customUser.DoesNotExist):
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_401_UNAUTHORIZED)

        # Optional: Handle invited game (if game_id and opponent_username are provided)
        game_id = request.data.get('game_id')
        opponent_username = request.data.get('opponent_username')
        is_creator = request.data.get('is_creator', False)

        # Communicate with WebSocket consumer via channel layer
        channel_layer = get_channel_layer()
        if game_id and opponent_username:
            # Join invited game
            async_to_sync(channel_layer.group_send)(
                "matchmaking",
                {
                    "type": "join_invited_game",
                    "user_id": user.id,
                    "username": user.username,
                    "game_id": game_id,
                    "opponent_username": opponent_username,
                    "is_game_creator": is_creator
                }
            )
            return Response({
                "status": "joining_invited_game",
                "game_id": game_id,
                "opponent": opponent_username
            }, status=status.HTTP_200_OK)
        else:
            # Initiate matchmaking
            async_to_sync(channel_layer.group_send)(
                "matchmaking",
                {
                    "type": "find_match",
                    "user_id": user.id,
                    "username": user.username
                }
            )
            return Response({"status": "searching"}, status=status.HTTP_200_OK)

class MatchMoveAPIView(APIView):
    """
    API endpoint to send paddle movement input (up/down/stop).
    Requires JWT authentication and an active game.
    """
    def post(self, request):
        # Extract and validate JWT from cookie
        token = request.COOKIES.get('access_token')
        if not token:
            return Response({"error": "Authentication token not provided"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            access_token = AccessToken(token)
            user_id = access_token.payload.get('user_id')
            user = customUser.objects.get(id=user_id)
        except (InvalidToken, TokenError, customUser.DoesNotExist):
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_401_UNAUTHORIZED)

        # Validate direction input
        direction = request.data.get('direction')
        if direction not in ['up', 'down', 'stop']:
            return Response({"error": "Invalid direction. Must be 'up', 'down', or 'stop'"}, status=status.HTTP_400_BAD_REQUEST)

        # Map direction to input value (compatible with pongServer.js and pongEngine.py)
        input_value = {'up': -1, 'down': 1, 'stop': 0}.get(direction)

        # Send input to WebSocket consumer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"match_{user.id}",  # Assuming match group is named by user ID or match ID
            {
                "type": "player_input",
                "user_id": user.id,
                "input": input_value
            }
        )
        return Response({"status": "input_sent", "direction": direction}, status=status.HTTP_200_OK)

class MatchInfoAPIView(APIView):
    """
    API endpoint to retrieve current game state for the authenticated user.
    Requires JWT authentication and an active game.
    """
    def get(self, request):
        # Extract and validate JWT from cookie
        token = request.COOKIES.get('access_token')
        if not token:
            return Response({"error": "Authentication token not provided"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            access_token = AccessToken(token)
            user_id = access_token.payload.get('user_id')
            user = customUser.objects.get(id=user_id)
        except (InvalidToken, TokenError, customUser.DoesNotExist):
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_401_UNAUTHORIZED)

        # Fetch game state from WebSocket consumer or database
        channel_layer = get_channel_layer()
        # Simulate fetching game state (actual implementation depends on your consumer)
        # Here, we assume the consumer stores game state and can respond via channel layer
        try:
            game_state = async_to_sync(channel_layer.group_send)(
                f"match_{user.id}",
                {
                    "type": "get_game_state",
                    "user_id": user.id
                }
            )
            # Note: Actual game state retrieval requires consumer to send back data
            # For now, return a placeholder response
            return Response({
                "status": "game_state_retrieved",
                "game_state": {
                    "player_info": {
                        "player1": {"username": user.username, "elo": user.elo},
                        "player2": {"username": "opponent", "elo": 1000}
                    },
                    "score": {"player1": 0, "player2": 0},
                    "pads": {
                        "player1": {"x": 0, "y": 0},
                        "player2": {"x": 780, "y": 0}
                    },
                    "ball": {"x": 400, "y": 300}
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "No active game found or error retrieving state"}, status=status.HTTP_404_NOT_FOUND)

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
		if invitation.expire_if_needed():
			return JsonResponse({'success': False, 'message': 'Cette invitation a expiré'})

		data = json.loads(request.body) if request.body else {}
		action = data.get('action', request.POST.get('action', ''))

		if action not in ['accept', 'decline']:
			return JsonResponse({'success': False, 'message': 'Action invalide'})

		invitation.status = action + 'ed'
		invitation.save()

		# Generate a unique game_id for the match if accepted
		if action == 'accept':
			game_id = f"invitation_{invitation.id}_{int(time.time())}"
			invitation.game_id = game_id
			invitation.save()

			# Notify sender via WebSocket
			try:
				channel_layer = get_channel_layer()
				async_to_sync(channel_layer.group_send)(
					f"user_{invitation.sender.id}_notifications",
					{
						'type': 'invitation_accepted',
						'invitation_id': invitation.id,
						'game_id': game_id,
						'recipient_username': request.user.username,
						'recipient_nickname': request.user.nickname if hasattr(request.user, 'nickname') else None
					}
				)
				print(f"Notification sent to user_{invitation.sender.id}_notifications")
			except Exception as e:
				print(f"Error notifying sender about accepted invitation: {e}")

			return JsonResponse({
				'success': True,
				'message': 'Invitation acceptée',
				'game_id': game_id,
				'sender_username': invitation.sender.username
			})
		else:
			# Notify sender about declined invitation
			try:
				channel_layer = get_channel_layer()
				async_to_sync(channel_layer.group_send)(
					f"user_{invitation.sender.id}_notifications",
					{
						'type': 'invitation_declined',
						'invitation_id': invitation.id,
						'recipient_username': request.user.username
					}
				)
			except Exception as e:
				print(f"Error notifying sender about declined invitation: {e}")

			return JsonResponse({'success': True, 'message': 'Invitation refusée'})

	except GameInvitation.DoesNotExist:
		return JsonResponse({'success': False, 'message': 'Invitation introuvable'})

@login_required
def cancel_game_invitation(request):
	"""
	Cancel all pending invitations from the current user.
	"""
	try:
		# Get the pending invitations before updating them
		pending_invitations = list(GameInvitation.objects.filter(
			sender=request.user,
			status='pending'
		).values('id', 'recipient_id'))

		# Log cancellation action for debugging
		print(f"User {request.user.username} is cancelling {len(pending_invitations)} invitations")

		# Update status to cancelled
		cancelled_count = GameInvitation.objects.filter(
			sender=request.user,
			status='pending'
		).update(status='cancelled')

		affected_recipients = []

		# Try to notify recipients via WebSocket (if channel layer is configured)
		if pending_invitations:
			try:
				from channels.layers import get_channel_layer
				from asgiref.sync import async_to_sync

				channel_layer = get_channel_layer()
				if channel_layer:
					for invitation in pending_invitations:
						recipient_id = invitation['recipient_id']
						affected_recipients.append(recipient_id)

						try:
							# Send to recipient's notification channel
							async_to_sync(channel_layer.group_send)(
								f"user_{recipient_id}_notifications",
								{
									"type": "invitation_update",
									"invitation_id": invitation['id'],
									"status": "cancelled"
								}
							)
							print(f"Sent WebSocket notification to user_{recipient_id}_notifications")
						except Exception as e:
							print(f"Error sending WebSocket notification to user_{recipient_id}: {e}")
				else:
					print("No channel layer available for WebSocket notifications")
			except Exception as e:
				print(f"Error with WebSocket notification system: {e}")

		# Return success response
		return JsonResponse({
			'success': True,
			'message': f'Cancelled {cancelled_count} invitation(s)',
			'affected_recipients': affected_recipients,
			'invitations': [inv['id'] for inv in pending_invitations]
		})
	except Exception as e:
		print(f"Error cancelling invitations: {e}")
		return JsonResponse({
			'success': False,
			'message': str(e)
		}, status=500)

@login_required
def forfeit_match(request):
	"""Handle match forfeit via API call."""
	try:
		# Get the user's active matches from lobby manager
		from game.websockets.pongMatchConsumer import MatchConsumer

		# Mark user as forfeited in any active matches
		user = request.user
		forfeit_successful = False

		for match_id, match_data in list(MatchConsumer.lobby_manager.active_matches.items()):
			players = match_data.get('players', [])

			# Find if the current user is in this match
			for player in players:
				if player.user.id == user.id:
					# Use existing game logic to handle forfeit
					# This will eventually call remove_player
					winner = next((p for p in players if p.user.id != user.id), None)
					if winner:
						# Use the existing method for handling match results
						async_to_sync(MatchConsumer().handle_match_result)(
							match_id, winner.user.username
						)
						forfeit_successful = True

		return JsonResponse({
			'success': True,
			'message': 'Forfeit processed successfully' if forfeit_successful
					  else 'No active matches found'
		})
	except Exception as e:
		print(f"Error processing forfeit: {str(e)}")
		import traceback
		traceback.print_exc()
		return JsonResponse({
			'success': False,
			'message': f'Error processing forfeit: {str(e)}'
		}, status=500)

@login_required
def forfeit_tournament(request):
	"""Handle tournament forfeit via API call."""
	try:
		# Get the user's active tournament from tournament manager
		from game.websockets.pongTournamentConsumer import TournamentConsumer

		# Mark user as forfeited in any active tournament
		user = request.user
		forfeit_successful = False

		# Access the singleton tournament manager
		tournament_manager = TournamentConsumer.tournament_manager

		# Find all tournaments where the user is participating
		for tournament_id, tournament in list(tournament_manager.tournaments.items()):
			players = tournament.get("players", [])

			# Find if the current user is in this tournament
			for player in players:
				if player.user.id == user.id:
					# Use existing tournament logic to handle player disconnect
					forfeit_successful = async_to_sync(tournament_manager.handle_player_disconnect)(player)
					break

		return JsonResponse({
			'success': True,
			'message': 'Tournament forfeit processed successfully' if forfeit_successful
					  else 'No active tournament found'
		})
	except Exception as e:
		print(f"Error processing tournament forfeit: {str(e)}")
		import traceback
		traceback.print_exc()
		return JsonResponse({
			'success': False,
			'message': f'Error processing tournament forfeit: {str(e)}'
		}, status=500)


@api_view(['GET'])
def friends_view(request):
	token = request.COOKIES.get('access_token', '')

	try:
		validated_token = AccessToken(token)
		user_id = validated_token['user_id']
		user = customUser.objects.get(id=user_id)

		all_friends = user.friends.all()

		friends_data = []
		for friend in all_friends:
			friends_data.append({
				'username': friend.username,
				'nickname': friend.nickname,
				'profile_picture': friend.profile_picture.url if friend.profile_picture else None,
				'is_online': friend.is_online()
			})

		return Response({
			'friends': friends_data,
			'count': len(all_friends)
		}, status=status.HTTP_200_OK)

	except Exception as e:
		return Response({
			'friends': [],
			'count': 0,
			'error': str(e)
		}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
def add_friend_view(request):
	token = request.COOKIES.get('access_token', '')

	try:
		validated_token = AccessToken(token)
		user_id = validated_token['user_id']
		user = customUser.objects.get(id=user_id)

		friend_username = request.data.get('username')
		if not friend_username:
			return Response({'error': 'Nom d’utilisateur requis'}, status=status.HTTP_400_BAD_REQUEST)

		try:
			friend = customUser.objects.get(username=friend_username)
		except customUser.DoesNotExist:
			return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_404_NOT_FOUND)

		if friend == user:
			return Response({'error': 'Vous ne pouvez pas vous ajouter vous-même'}, status=status.HTTP_400_BAD_REQUEST)

		if friend in user.friends.all():
			return Response({'error': 'Cet utilisateur est déjà votre ami'}, status=status.HTTP_400_BAD_REQUEST)

		user.friends.add(friend)

		return Response({'success': True, 'message': f'{friend_username} ajouté comme ami'}, status=status.HTTP_200_OK)

	except Exception as e:
		return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
def remove_friend_view(request):
	token = request.COOKIES.get('access_token', '')

	try:
		validated_token = AccessToken(token)
		user_id = validated_token['user_id']
		user = customUser.objects.get(id=user_id)

		friend_username = request.data.get('username')
		if not friend_username:
			return Response({'error': 'Nom d’utilisateur requis'}, status=status.HTTP_400_BAD_REQUEST)

		try:
			friend = customUser.objects.get(username=friend_username)
		except customUser.DoesNotExist:
			return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_404_NOT_FOUND)

		if friend not in user.friends.all():
			return Response({'error': 'Cet utilisateur n’est pas dans votre liste d’amis'}, status=status.HTTP_400_BAD_REQUEST)

		user.friends.remove(friend)

		return Response({'success': True, 'message': f'{friend_username} supprimé de votre liste d’amis'}, status=status.HTTP_200_OK)

	except Exception as e:
		return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET'])
def user_me_detail(request):
	token = request.COOKIES.get('access_token', '')

	try:
		validated_token = AccessToken(token)
		user_id = validated_token['user_id']
		user = customUser.objects.get(id=user_id)

		serializer = UserDataSerializer(user)

		response_data = serializer.data
		response_data['is_online'] = user.is_online()

		return Response({
			'user': response_data,
			'status': 'success'
		}, status=status.HTTP_200_OK)

	except Exception as e:
		return Response({
			'user': None,
			'status': 'error',
			'error': str(e)
		}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
def get_snake_high_score(request):
	"""
	Get the list of all players' high scores in Snake game, sorted by score.
	"""
	try:
		# Get all users with their snake high scores
		users = customUser.objects.filter(snake_high_score__gt=0).order_by('-snake_high_score')

		# Create a list of players with their scores
		players_scores = []
		for user in users:
			players_scores.append({
				'username': user.nickname or user.username,
				'score': user.snake_high_score,
				'profile_picture': user.profile_picture.url if user.profile_picture else None
			})

		# Get current user's score if authenticated
		current_user_score = None
		current_user_username = None
		current_user_picture = None
		if request.user.is_authenticated:
			current_user_score = request.user.snake_high_score
			current_user_username = request.user.nickname or request.user.username
			current_user_picture = request.user.profile_picture.url if request.user.profile_picture else None

		response_data = {
			'players_scores': players_scores,
			'current_user_score': current_user_score,
			'current_user_username': current_user_username,
			'current_user_picture': current_user_picture
		}

		return JsonResponse(response_data)
	except Exception as e:
		return JsonResponse({'error': str(e)}, status=500)

@api_view(['POST'])
def update_snake_score(request):
	"""
	Update the user's snake high score if the current score is higher.
	"""
	try:
		token = request.COOKIES.get('access_token', '')
		if not token:
			return JsonResponse({'error': 'Token non trouvé'}, status=401)

		try:
			validated_token = AccessToken(token)
			user_id = validated_token['user_id']
			user = customUser.objects.get(id=user_id)
		except Exception as e:
			return JsonResponse({'error': 'Token invalide'}, status=401)

		print("Tentative de mise à jour du score pour l'utilisateur:", user.username)

		score = request.data.get('score')
		print("Score reçu:", score)

		if not score or not isinstance(score, int):
			return JsonResponse({'error': 'Score invalide'}, status=400)

		print("Score actuel de l'utilisateur:", user.snake_high_score)

		if score > user.snake_high_score:
			user.snake_high_score = score
			user.save()
			print("Nouveau meilleur score enregistré:", score)
			return JsonResponse({
				'success': 'Score mis à jour',
				'new_high_score': score
			})

		print("Score non mis à jour car inférieur au meilleur score actuel")
		return JsonResponse({
			'success': 'Score non mis à jour',
			'current_high_score': user.snake_high_score
		})
	except Exception as e:
		print("Erreur lors de la mise à jour du score:", str(e))
		return JsonResponse({'error': str(e)}, status=500)
