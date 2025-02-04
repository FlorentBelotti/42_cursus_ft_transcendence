from connector.user_connector import get_all_users, get_user_by_id, create_user, update_user, delete_user

def list_users():
    return get_all_users()

def find_user(user_id):
    return get_user_by_id(user_id)

def add_user(nickname):
    return create_user(nickname)

def modify_user(user_id, data):
    user = get_user_by_id(user_id)
    if user:
        return update_user(user, data)
    return None

def remove_user(user_id):
    user = get_user_by_id(user_id)
    if user:
        delete_user(user)
        return True
    return False
