from django.urls import path
from .views import (create_user, list_users, user_detail, update_user, delete_user,
                   logout_action, RefreshTokenView, online_friends_view,
                   get_user_invitations, respond_to_invitation, cancel_game_invitation,
                   forfeit_match, forfeit_tournament, friends_view, user_me_detail, friends_view, add_friend_view, user_me_detail,
                   post_login, remove_friend_view)

from django.conf import settings
from django.conf.urls.static import static
from django.urls import include

urlpatterns = [
    path('users/', list_users, name='list_users'),
    path('users/create/', create_user, name='create_user'),
    path('users/me/', user_me_detail, name='user_me_detail'),
    path('users/<int:pk>/', user_detail, name='user_detail'),
    path('users/<int:pk>/update/', update_user, name='update_user'),
    path('users/<int:pk>/delete/', delete_user, name='delete_user'),
    path('logout/action', logout_action, name='logout_action'),
    path('refresh-token/', RefreshTokenView.as_view(), name='token_refresh'),
    path('invitations/', get_user_invitations, name='get_user_invitations'),
    path('invitations/<int:invitation_id>/respond/', respond_to_invitation, name='respond_to_invitation'),
    path('invitations/cancel/', cancel_game_invitation, name='cancel_game_invitation'),
    path('match/forfeit/', forfeit_match, name='forfeit_match'),
    path('tournament/forfeit/', forfeit_tournament, name='forfeit_tournament'),

	path('friends/', friends_view, name='friends_view'),
    path('online-friends/', online_friends_view, name='online_friends_api'),
	path('friends/add/', add_friend_view, name='add_friend'),
    path('friends/remove/', remove_friend_view, name='remove_friend'),

    path('post-login/', post_login, name='post_login'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
