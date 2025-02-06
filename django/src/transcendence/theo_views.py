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

User = get_user_model()

@method_decorator(csrf_exempt, name='dispatch')
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

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
                return Response({"message": "Code verified"}, status=status.HTTP_200_OK)
            return Response({"message": "Invalid or expired code"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)