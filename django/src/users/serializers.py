from rest_framework import serializers
from .models import customUser
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = customUser
        fields = ['username', 'email', 'password']
        extra_kwargs = {
            'password': {'write_only': True}
        }

class UserDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = customUser
        fields = ['id', 'username', 'email', 'password', 'elo']
        extra_kwargs = {
            'password': {'write_only': True}
        }
