from django.urls import path
from .views import create_user, list_users, user_detail, update_user, delete_user, logout_action, RefreshTokenView, online_friends_view, get_user_invitations, respond_to_invitation, cancel_game_invitation

urlpatterns = [
    path('users/', list_users, name='list_users'),
    path('users/create/', create_user, name='create_user'),
    path('users/<int:pk>/', user_detail, name='user_detail'),
    path('users/<int:pk>/update/', update_user, name='update_user'),
    path('users/<int:pk>/delete/', delete_user, name='delete_user'),
    path('logout/action', logout_action, name='logout_page'),
    path('refresh-token/', RefreshTokenView.as_view(), name='token_refresh'),
    path('online-friends/', online_friends_view, name='online_friends_api'),
    path('invitations/', get_user_invitations, name='get_user_invitations'),
    path('invitations/<int:invitation_id>/respond/', respond_to_invitation, name='respond_to_invitation'),
    path('invitations/cancel/', cancel_game_invitation, name='cancel_game_invitation'),
]
