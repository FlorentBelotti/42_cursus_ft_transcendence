from django.urls import path
from django.views.generic import RedirectView
from views import views
from django.conf import settings
from django.conf.urls.static import static

from transcendence.controller import user_controller
from rest_framework_simplejwt.views import TokenRefreshView
from .theo_views import SendVerificationCodeView, VerifyCodeView
from .theo_views import CustomTokenObtainPairView, SendVerificationCodeView, VerifyCodeView
from .theo_views import SendVerificationCodeView, VerifyCodeView


urlpatterns = [
    path('', RedirectView.as_view(url='/home/', permanent=True)),
    path('header/', views.define_render, name='header'),
    path('home/', views.define_render, name='home'),
    path('about/', views.define_render, name='about'),
    path('register/', views.define_render, name='register'),
    path('login/', views.define_render, name='login'),
    path('pong/', views.define_render, name='pong'),
    path('tournament/', views.define_render, name='tournament'),
    path('match/', views.define_render, name='match'),
    path('vsBot/', views.define_render, name='vsBot'),
    path('leaderboard/', views.define_render, name='leaderboard'),
    path('pongserver/', views.define_render, name='pongServer'),
    path('authentication/', views.define_render, name='authentication'),
    path('account/', views.define_render, name='account'),
    path('logout/', VerifyCodeView.logout_page, name='logout_page'),
    path('logout/action/', VerifyCodeView.logout_action, name='logout_action'),
    path('api/users/', user_controller.user_list, name='user_list'),
    path('api/users/<int:pk>/', user_controller.user_detail, name='user_detail'),
    path('api/users/create/', user_controller.user_create, name='user_create'),
    path('api/users/<int:pk>/update/', user_controller.user_update, name='user_update'),
    path('api/users/<int:pk>/delete/', user_controller.user_delete, name='user_delete'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/send-verification-code/', SendVerificationCodeView.as_view(), name='send_verification_code'),
    path('api/verify-code/', VerifyCodeView.as_view(), name='verify_code'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)