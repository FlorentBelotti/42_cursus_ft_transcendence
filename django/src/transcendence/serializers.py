from rest_framework import serializers
from .models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'nickname', 'elo', 'email', 'password', 'is_admin']

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = User.objects.filter(email=email).first()
        if user and user.check_password(password):
            if not user.is_active:
                raise serializers.ValidationError("User account is disabled.")
            attrs["username"] = user.email
            return super().validate(attrs)
        else:
            raise serializers.ValidationError("Invalid email or password")

    def get_token(self, user):
        token = super().get_token(user)
        token['rank'] = 0
        return token

