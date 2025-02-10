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
from django.contrib.auth import login, authenticate
from django.contrib.auth.forms import AuthenticationForm
from django.conf import settings
import uuid
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from django.shortcuts import render, redirect
from .models import customUser
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages
from .forms import UserUpdateForm, CustomPasswordChangeForm

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

            # Génère un access token et un refresh token
            user = verification_code.user
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            # Stocke les tokens dans les cookies (ou renvoie-les en JSON)
            response = redirect("home")
            response.set_cookie(
                key='access_token',
                value=access_token,
                httponly=True,
                secure=True  # En production uniquement
            )
            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                httponly=True,
                secure=True  # En production uniquement
            )
            
            return response
            
        except VerificationCode.DoesNotExist:
            return render(request, "verify_code.html", {"error": "Code invalide."})
    return render(request, "verify_code.html")

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

@login_required
def account(request):
    if request.method == "POST":
        user_form = UserUpdateForm(request.POST, request.FILES, instance=request.user)
        password_form = CustomPasswordChangeForm(request.user, request.POST)

        if 'update_info' in request.POST:
            if user_form.is_valid():
                user_form.save()
                messages.success(request, "Informations mises à jour !")
                return redirect('account')

        elif 'change_password' in request.POST:
            if password_form.is_valid():
                password_form.save()
                update_session_auth_hash(request, request.user)
                messages.success(request, "Mot de passe mis à jour !")
                return redirect('account')

        elif 'delete_account' in request.POST:
            request.user.delete()
            response = redirect('home')
            response.delete_cookie('access_token')
            response.delete_cookie('refresh_token')
            return response

    else:
        user_form = UserUpdateForm(instance=request.user)
        password_form = CustomPasswordChangeForm(request.user)

    return render(request, 'account.html', {
        'user_form': user_form,
        'password_form': password_form
    })