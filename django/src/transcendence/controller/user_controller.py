from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from transcendence.service.user_service import get_users, get_user, create_new_user, update_existing_user, delete_existing_user
from transcendence.serializers import UserSerializer

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
    data = request.data
    nickname = data.get('nickname')
    password = data.get('password')
    elo = data.get('elo')

    if not nickname or not password or elo is None:
        return Response({'message': 'Invalid data'}, status=status.HTTP_400_BAD_REQUEST)

    user = create_new_user(nickname, password, elo)
    serializer = UserSerializer(user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

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

    updated_user = update_existing_user(pk, nickname, password, elo)
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
