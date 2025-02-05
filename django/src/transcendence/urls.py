from django.urls import path
from django.views.generic import RedirectView
from views import views

urlpatterns = [
    path('', RedirectView.as_view(url='/home/', permanent=True)),
    path('header/', views.header, name='header'),
    path('home/', views.home, name='home'),
    path('about/', views.about, name='about'),
]