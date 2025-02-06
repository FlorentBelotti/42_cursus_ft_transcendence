from django.urls import path
from django.views.generic import RedirectView
from views import views

urlpatterns = [
    path('', RedirectView.as_view(url='/home/', permanent=True)),
    path('header/', views.header, name='header'),
    path('home/', views.home, name='home'),
    path('about/', views.about, name='about'),
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('pong/', views.pong, name='pong'),
    path('tournament/', views.tournament, name='tournament'),
    path('match/', views.match, name='match'),
    path('vsBot/', views.vsBot, name='vsBot'),
    path('leaderboard/', views.vsBot, name='leaderboard'),
]