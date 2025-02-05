from django.contrib import admin
from django.urls import path

from django.urls import path
from views.test_fbelotti_1 import home, load_page

urlpatterns = [
    path('', home, name="home"),
    path('load-page/<str:page>/', load_page, name="load_page"),
]
