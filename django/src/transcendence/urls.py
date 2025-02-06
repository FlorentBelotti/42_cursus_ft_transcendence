from django.urls import path
from django.views.generic import RedirectView
from views import views

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
]