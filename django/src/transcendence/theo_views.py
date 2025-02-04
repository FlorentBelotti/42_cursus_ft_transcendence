from django.http import JsonResponse
from transcendence.models import User
from transcendence.serializers import UserSerializer
from controller.scoreboard.scoreboard_controller import get_scoreboard_view

def create_new_user(request):
    if request.method == 'POST':
        nickname = request.POST.get('nickname')
        if nickname:
            user = User.objects.create(nickname=nickname)
            
            user_serializer = UserSerializer(user)
            return JsonResponse(user_serializer.data, status=201)
        else:
            return JsonResponse({'error': 'Nickname is required!'}, status=400)
