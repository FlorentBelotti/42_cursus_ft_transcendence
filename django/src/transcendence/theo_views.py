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