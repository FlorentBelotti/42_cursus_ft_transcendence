from django.urls import path
from .views import create_user, list_users, user_detail, update_user, delete_user, logout_action

urlpatterns = [
    path('users/', list_users, name='list_users'),
    path('users/create/', create_user, name='create_user'),
    path('users/<int:pk>/', user_detail, name='user_detail'),
    path('users/<int:pk>/update/', update_user, name='update_user'),
    path('users/<int:pk>/delete/', delete_user, name='delete_user'),
    path('logout/action', logout_action, name='logout_page'),
    # path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    # path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # path('api/send-verification-code/', SendVerificationCodeView.as_view(), name='send_verification_code'),
    # path('api/verify-code/', VerifyCodeView.as_view(), name='verify_code'),
]
