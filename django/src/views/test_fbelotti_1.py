from django.shortcuts import render

def base(request):
    return render(request, 'base.html')

def home_content(request):
    return render(request, 'home_content.html')

def about_us(request):
    return render(request, 'about_us.html')