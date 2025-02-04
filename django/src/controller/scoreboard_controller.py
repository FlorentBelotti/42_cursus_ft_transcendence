from rest_framework.decorators import api_view
from rest_framework.response import Response
from service.scoreboard_service import get_scoreboard

@api_view(['GET'])
def get_scoreboard_view(request):
    """
    Vue qui récupère le classement des joueurs via le service et retourne une réponse JSON.
    """
    scoreboard_data = get_scoreboard()
    return Response(scoreboard_data)