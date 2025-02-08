from transcendence.connector.user_connector import get_all_users, get_user_by_id, create_user, update_user, delete_user
from django.contrib.auth.hashers import make_password, check_password

def get_users():
    return get_all_users()

def get_user(user_id):
    return get_user_by_id(user_id)

def create_new_user(nickname, password, elo, email):
    hashed_password = make_password(password)
    return create_user(nickname, hashed_password, elo, email)

def update_existing_user(user_id, nickname, password, elo, email, is_admin):
    user = get_user_by_id(user_id)
    hashed_password = make_password(password)
    return update_user(user, nickname, hashed_password, elo, email, is_admin)

def delete_existing_user(user_id):
    user = get_user_by_id(user_id)
    delete_user(user)
