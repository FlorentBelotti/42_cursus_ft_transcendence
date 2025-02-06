from django.urls import path
from django.contrib import admin
from transcendence.controller import user_controller
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .theo_views import SendVerificationCodeView, VerifyCodeView
from .theo_views import CustomTokenObtainPairView, SendVerificationCodeView, VerifyCodeView
from .theo_views import CustomTokenObtainPairViewRank, SendVerificationCodeView, VerifyCodeView


urlpatterns = [
    path('api/users/', user_controller.user_list, name='user_list'),
    path('api/users/<int:pk>/', user_controller.user_detail, name='user_detail'),
    path('api/users/create/', user_controller.user_create, name='user_create'),
    path('api/users/<int:pk>/update/', user_controller.user_update, name='user_update'),
    path('api/users/<int:pk>/delete/', user_controller.user_delete, name='user_delete'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token-ranked/', CustomTokenObtainPairViewRank.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/send-verification-code/', SendVerificationCodeView.as_view(), name='send_verification_code'),
    path('api/verify-code/', VerifyCodeView.as_view(), name='verify_code'),
]