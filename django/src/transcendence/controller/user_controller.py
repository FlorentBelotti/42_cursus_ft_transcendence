from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from transcendence.service.user_service import get_users, get_user, create_new_user, update_existing_user, delete_existing_user
from transcendence.serializers import UserSerializer
from transcendence.models import User

@api_view(['GET'])
def user_list(request):
    users = get_users()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def user_detail(request, pk):
    try:
        user = get_user(pk)
    except User.DoesNotExist:
        return Response({'message': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = UserSerializer(user)
    return Response(serializer.data)

@api_view(['POST'])
def user_create(request):
    nickname = request.data.get('nickname')
    password = request.data.get('password')
    elo = request.data.get('elo')
    email = request.data.get('email')

    if not nickname or not password or not elo or not email:
        return Response({"message": "Invalid data"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = create_new_user(nickname, password, elo, email)
        return Response({"message": "User created successfully", "user": user.id}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
def user_update(request, pk):
    try:
        user = get_user(pk)
    except User.DoesNotExist:
        return Response({'message': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data
    nickname = data.get('nickname')
    password = data.get('password')
    elo = data.get('elo')
    is_admin = data.get('is_admin')

    updated_user = update_existing_user(pk, nickname, password, elo, is_admin)
    serializer = UserSerializer(updated_user)
    return Response(serializer.data)

@api_view(['DELETE'])
def user_delete(request, pk):
    try:
        user = get_user(pk)
    except User.DoesNotExist:
        return Response({'message': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    delete_existing_user(pk)
    return Response(status=status.HTTP_204_NO_CONTENT)
