from django.shortcuts import render

def define_render(request):
    template_name = request.path[1:].rstrip('/') + '.html'
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, template_name)
    else:
        return render(request, 'base.html', {'content_template': template_name})