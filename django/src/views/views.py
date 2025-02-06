from django.shortcuts import render

def header(request):
    return render(request, 'header.html')

def define_render(request, template_name):
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, template_name)
    else:
        return render(request, 'base.html', {'content_template': template_name})

def home(request):
    return define_render(request, 'home.html')

def about(request):
    return define_render(request, 'about.html')

def register(request):
    return define_render(request, 'register.html')

def login(request):
    return define_render(request, 'login.html')

def pong(request):
    return define_render(request, 'pong.html')

def tournament(request):
    return define_render(request, 'tournament.html')

def match(request):
    return define_render(request, 'match.html')

def vsBot(request):
    return define_render(request, 'vsBot.html')

def leaderboard(request):
    return define_render(request, 'leaderboard.html')