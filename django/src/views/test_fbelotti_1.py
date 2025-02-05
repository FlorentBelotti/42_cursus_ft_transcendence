from django.shortcuts import render
from django.http import JsonResponse
from django.template.loader import render_to_string

def home(request):
    """ Charge la page principale """
    return render(request, "base.html")

def load_page(request, page):
    """ Charge dynamiquement le contenu des pages demandées """
    templates = {
        "home": "home.html",
        "login": "login.html",
        "register": "register.html",
        "users": "users.html",
    }
    
    template_name = templates.get(page, "pages/404.html")  # Page par défaut si non trouvée
    content_html = render_to_string(template_name)
    
    return JsonResponse({"html": content_html})
