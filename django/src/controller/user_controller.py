from rest_framework.decorators import api_view
from rest_framework.response import Response
from service.user_service import list_users, find_user, add_user, modify_user, remove_user
from transcendence.models import User
from transcendence.serializers import UserSerializer

@api_view(['GET'])
def get_users(request):
    users = list_users()
    return Response(users)

@api_view(['GET'])
def get_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
        user_serializer = UserSerializer(user)
        return Response(user_serializer.data)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)

@api_view(['POST'])
def create_new_user(request):
    data = request.data
    user = add_user(data.get('nickname'))
    return Response({"message": "User created", "user": user})

@api_view(['PUT'])
def update_existing_user(request, user_id):
    data = request.data
    user = modify_user(user_id, data)
    if user:
        return Response({"message": "User updated", "user": user})
    return Response({"error": "User not found"}, status=404)

@api_view(['DELETE'])
def delete_existing_user(request, user_id):
    success = remove_user(user_id)
    if success:
        return Response({"message": "User deleted"})
    return Response({"error": "User not found"}, status=404)
