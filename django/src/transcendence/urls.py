from django.urls import path
from .theo_views import UserCreateView, UserListView
from django.contrib import admin


urlpatterns = [
    path('admin/', admin.site.urls),
]

urlpatterns = [
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/create/', UserCreateView.as_view(), name='user-create'),
]

