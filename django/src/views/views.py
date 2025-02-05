from django.shortcuts import render

def base(request):
    return render(request, 'base.html')

def header(request):
    return render(request, 'header.html')

def home(request):
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'home.html')
    else:
        return render(request, 'base.html', {'content_template': 'home.html'})

def about(request):
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'about.html')
    else:
        return render(request, 'base.html', {'content_template': 'about.html'})