from django.urls import path, include
from django.views.generic import RedirectView
from views import views
from django.conf import settings
from django.conf.urls.static import static
from users.views import password_reset_confirm, password_reset_request, auth_error
from django_prometheus import exports

urlpatterns = [
	path('', RedirectView.as_view(url='/home/', permanent=True)),
	path('header/', views.define_render, name='header'),
	path('home/', views.define_render, name='home'),
	path('authentication/', views.define_render, name='authentication'),
	path('register/', views.register, name='register'),
	path('auth/', include('social_django.urls', namespace='social')),

	path('login/', views.user_login, name='login'),
	path('verify_code/<int:user_id>/', views.verify_code, name='verify_code'),
	path('api/auth-status/', views.check_auth_status, name='auth_status'),
	path('account/', views.account, name='account'),
	path('friends/', views.friends_view, name='friends'),
	path('password_reset/', password_reset_request, name='password_reset_request'),
	path('password_reset_confirm/<uidb64>/<token>/', password_reset_confirm, name='password_reset_confirm'),

	path('leaderboard/', views.leaderboard, name='leaderboard'),
	path('api/', include('users.urls')),
	path('', include('game.pongAPI.urls')),
	path('auth/', include('social_django.urls', namespace='social')),
	path('snake/', views.define_render, name='snake'),
	path('local/', views.define_render, name='local'),
	path('vsBot/', views.define_render, name='vsBot'),
	path('match/', views.define_render, name='match'),
	path('tournament/', views.define_render, name='tournament'),
	path('friends/', views.friends_view, name='friends'),

	path('legal_rgpd/', views.define_render, name='rgpd'),
	path('legal_mentions_legales/', views.define_render, name='mentions_legales'),
	path('legal_cgu/', views.define_render, name='regles'),

	path('', include('django_prometheus.urls')),
	path('metrics/', exports.ExportToDjangoView, name='prometheus-metrics'),

	# URL pour gérer les erreurs d'authentification OAuth
	path('auth/error/', auth_error, name='social_auth_error'),
]

if settings.DEBUG:
	urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
	urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
