from transcendence.models import User

def get_all_users():
    return list(User.objects.values())

def get_user_by_id(user_id):
    return User.objects.filter(id=user_id).first()

def create_user(nickname):
    user = User.objects.create(nickname=nickname)
    return user

def update_user(user, data):
    user.nickname = data.get('nickname', user.nickname)
    user.save()
    return user

def delete_user(user):
    user.delete()
