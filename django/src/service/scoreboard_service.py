from connector.scoreboard_connector import get_all_users
from transcendence.serializers import UserSerializer

def get_scoreboard():
    """
    Récupère les utilisateurs, les trie par Elo et les sérialise pour l'API.
    """
    users = get_all_users()
    user_serializer = UserSerializer(users, many=True)
    return user_serializer.data