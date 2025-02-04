from django.contrib import admin
from django.urls import path
from views.test_fbelotti_1 import home_content
from views.test_fbelotti_1 import about_us
from views.test_fbelotti_1 import base

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', base, name='base'),  # URL racine redirigeant vers base
    path('home/', home_content, name='home_content'),
    path('about/', about_us, name='about_us'),
]