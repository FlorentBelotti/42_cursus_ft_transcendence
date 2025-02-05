from django.urls import path
from views import views

urlpatterns = [
    path('', views.base, name='base'),
    path('header/', views.header, name='header'),
    path('home/', views.home, name='home'),
    path('about/', views.about, name='about'),
]