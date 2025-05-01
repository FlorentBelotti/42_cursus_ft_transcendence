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
        fields = ['id', 'username', 'email', 'password', 'elo', 'profile_picture', 'last_login']
        extra_kwargs = {
            'password': {'write_only': True}
        }
    def get_profile_picture(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None
