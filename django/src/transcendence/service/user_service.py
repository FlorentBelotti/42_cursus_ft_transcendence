from transcendence.connector.user_connector import get_all_users, get_user_by_id, create_user, update_user, delete_user
from django.contrib.auth.hashers import make_password, check_password

def get_users():
    return get_all_users()

def get_user(user_id):
    return get_user_by_id(user_id)

def create_new_user(username, password, elo):
    hashed_password = make_password(password)
    return create_user(username, hashed_password, elo)

def update_existing_user(user_id, username, password, elo):
    user = get_user_by_id(user_id)
    hashed_password = make_password(password)
    return update_user(user, username, hashed_password, elo)

def delete_existing_user(user_id):
    user = get_user_by_id(user_id)
    delete_user(user)
