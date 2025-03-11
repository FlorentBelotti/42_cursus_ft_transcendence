from django.urls import path, include
from django.views.generic import RedirectView
from views import views
from django.conf import settings
from django.conf.urls.static import static
from users.views import logout_view

urlpatterns = [
    path('', RedirectView.as_view(url='/home/', permanent=True)),
    path('header/', views.define_render, name='header'),
    path('home/', views.define_render, name='home'),
    path('authentication/', views.define_render, name='authentication'),
    path('register/', views.register, name='register'),

    path('login/', views.user_login, name='login'),
    path('verify_code/<int:user_id>/', views.verify_code, name='verify_code'),
    path('api/auth-status/', views.check_auth_status, name='auth_status'),
    path('account/', views.account, name='account'),

    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('logout/', logout_view, name='logout'),
    path('api/', include('users.urls')),
    path('auth/', include('social_django.urls', namespace='social')),
    path('snake/', views.define_render, name='snake'),
	path('local/', views.define_render, name='local'),
    path('vsBot/', views.define_render, name='vsBot'),
    path('match/', views.define_render, name='match'),
    path('tournament/', views.define_render, name='tournament'),
    path('friends/', views.friends_view, name='friends'),

    path('', include('django_prometheus.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
