from django.shortcuts import render
import jwt
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
import logging
from django.shortcuts import render, redirect
from django.http import HttpResponse

def define_render(request):
    template_name = request.path[1:].rstrip('/') + '.html'

    context = {
        'content_template': template_name,
    }

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, template_name)
    else:
        return render(request, 'base.html', context)
