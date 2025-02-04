from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'nickname', 'elo', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            nickname=validated_data['nickname'],
            password=validated_data['password'],
            elo=validated_data.get('elo', 1000)
        )
        return user
