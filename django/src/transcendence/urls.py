from django.urls import path
from django.contrib import admin
from transcendence.controller import user_controller
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
]

urlpatterns = [
    path('api/users/', user_controller.user_list, name='user_list'),
    path('api/users/<int:pk>/', user_controller.user_detail, name='user_detail'),
    path('api/users/create/', user_controller.user_create, name='user_create'),
    path('api/users/<int:pk>/update/', user_controller.user_update, name='user_update'),
    path('api/users/<int:pk>/delete/', user_controller.user_delete, name='user_delete'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]