from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import status
from .models import VerificationCode
from .serializers import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
import logging
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect
from django.http import HttpResponseRedirect

logger = logging.getLogger(__name__)

User = get_user_model()

@method_decorator(csrf_exempt, name='dispatch')
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            token = response.data['access']
            response.set_cookie(
                key='access_token',
                value=token,
                httponly=True,
                secure=True,
                samesite='Strict'
            )
            logger.info(f"Cookie set: access_token={token}")
        else:
            logger.warning(f"Failed to set cookie, response status: {response.status_code}")
        return response

class ProtectedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"message": "Vous avez accès à cette vue protégée!"})

class SendVerificationCodeView(APIView):
    def post(self, request):
        email = request.data.get('email')
        user = User.objects.filter(email=email).first()
        if user:
            code = VerificationCode.objects.create(user=user)
            send_mail(
                'Your verification code',
                f'Your verification code is {code.code}',
                'from@example.com',
                [email],
                fail_silently=False,
            )
            return Response({"message": "Verification code sent"}, status=status.HTTP_200_OK)
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

class VerifyCodeView(APIView):
    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        user = User.objects.filter(email=email).first()
        if user:
            verification_code = VerificationCode.objects.filter(user=user, code=code, is_used=False).first()
            if verification_code and (timezone.now() - verification_code.created_at).seconds < 300:
                verification_code.is_used = True
                verification_code.save()

                # Générer le token JWT avec le rang approprié
                refresh = RefreshToken.for_user(user)
                access_token = refresh.access_token

                # Ajouter le rang au token d'accès
                if user.is_admin:
                    access_token['rank'] = 2
                else:
                    access_token['rank'] = 1

                # Créer la réponse
                response = Response({
                    "message": "Code verified",
                    "access": str(access_token),
                    "refresh": str(refresh)
                }, status=status.HTTP_200_OK)

                # Ajouter les tokens dans les cookies
                response.set_cookie(
                    key='access_token',
                    value=str(access_token),
                    httponly=True,
                    secure=True,
                    samesite='Strict'
                )
                response.set_cookie(
                    key='refresh_token',
                    value=str(refresh),
                    httponly=True,
                    secure=True,
                    samesite='Strict'
                )

                return response
            return Response({"message": "Invalid or expired code"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)


from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import customUser
from .serializers import UserSerializer
from django.shortcuts import render, redirect
from django.contrib.auth import login
from .forms import RegisterForm

# Create
@api_view(['POST'])
def create_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Read (List)
@api_view(['GET'])
def list_users(request):
    users = customUser.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

# Read (Detail)
@api_view(['GET'])
def user_detail(request, pk):
    try:
        user = customUser.objects.get(pk=pk)
    except customUser.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    serializer = UserSerializer(user)
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