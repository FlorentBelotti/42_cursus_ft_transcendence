from transcendence.models import User

def get_all_users():
    """
    Récupère tous les utilisateurs de la base de données, triés par Elo.
    """
    return User.objects.all().order_by('-elo')
