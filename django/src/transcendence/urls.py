from django.contrib import admin
from django.urls import path
from controller.user_controller import get_users, get_user, create_new_user, update_existing_user, delete_existing_user
from controller.scoreboard_controller import get_scoreboard_view

urlpatterns = [
    path('admin/', admin.site.urls),
]

urlpatterns = [
    path('users/', get_users, name="get_users"),
    path('users/<int:user_id>/', get_user, name="get_user"),
    path('users/create/', create_new_user, name="create_user"),
    path('users/update/<int:user_id>/', update_existing_user, name="update_user"),
    path('users/delete/<int:user_id>/', delete_existing_user, name="delete_user"),
    path('scoreboard/', get_scoreboard_view, name='scoreboard'),
]
