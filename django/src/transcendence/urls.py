from django.urls import path, include
from django.views.generic import RedirectView
from views import views
from django.conf import settings
from django.conf.urls.static import static
from users.views import register, user_login, verify_code, account, logout_view

urlpatterns = [
    path('', RedirectView.as_view(url='/home/', permanent=True)),
    path('header/', views.define_render, name='header'),
    path('home/', views.define_render, name='home'),
    path('about/', views.define_render, name='about'),
    path('register/', register, name='register'),
    path('login/', user_login, name='login'),
    path('verify_code/<int:user_id>/', verify_code, name='verify_code'),
    path('pong/', views.define_render, name='pong'),
    path('tournament/', views.define_render, name='tournament'),
    path('match/', views.define_render, name='match'),
    path('vsBot/', views.define_render, name='vsBot'),
    path('leaderboard/', views.define_render, name='leaderboard'),
    path('pongserver/', views.define_render, name='pongServer'),
    path('authentication/', views.define_render, name='authentication'),
    path('account/', account, name='account'),
    path('leaderboard/', views.define_render, name='leaderboard'),
    path('logout/', logout_view, name='logout'),
    path('api/', include('users.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)