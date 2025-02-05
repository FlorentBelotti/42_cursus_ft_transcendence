from django.shortcuts import render

def base(request):
    return render(request, 'base.html')

def header(request):
    return render(request, 'header.html')

def home_content(request):
    return render(request, 'home_content.html', {}, content_type='text/html')

def about_us(request):
    return render(request, 'about_us.html')