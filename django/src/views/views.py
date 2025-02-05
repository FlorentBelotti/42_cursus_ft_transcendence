from django.shortcuts import render

def base(request):
    return render(request, 'base.html')

def header(request):
    return render(request, 'header.html')

def home(request):
    return render(request, 'home.html')

def about(request):
    return render(request, 'about.html')