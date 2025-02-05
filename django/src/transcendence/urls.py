from django.urls import path
from django.contrib import admin
from transcendence.controller import user_controller


urlpatterns = [
    path('admin/', admin.site.urls),
]

urlpatterns = [
    path('users/', user_controller.user_list, name='user_list'),
    path('users/<int:pk>/', user_controller.user_detail, name='user_detail'),
    path('users/create/', user_controller.user_create, name='user_create'),
    path('users/<int:pk>/update/', user_controller.user_update, name='user_update'),
    path('users/<int:pk>/delete/', user_controller.user_delete, name='user_delete'),
]
