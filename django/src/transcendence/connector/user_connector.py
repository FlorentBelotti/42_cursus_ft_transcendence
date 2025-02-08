from transcendence.models import User

def get_all_users():
    return User.objects.all()

def get_user_by_id(user_id):
    return User.objects.get(id=user_id)

def create_user(nickname, password, elo, email):
    user = User(nickname=nickname, password=password, elo=elo, email=email)
    user.save()
    return user

def update_user(user, nickname, password, elo, email):
    user.nickname = nickname
    user.password = password
    user.elo = elo
    user.email = email
    user.save()
    return user

def delete_user(user):
    user.delete()
