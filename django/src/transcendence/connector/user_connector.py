from transcendence.models import User

def get_all_users():
    return User.objects.all()

def get_user_by_id(user_id):
    return User.objects.get(id=user_id)

def create_user(username, password, elo):
    user = User(username=username, password=password, elo=elo)
    user.save()
    return user

def update_user(user, username, password, elo):
    user.username = username
    user.password = password
    user.elo = elo
    user.save()
    return user

def delete_user(user):
    user.delete()
