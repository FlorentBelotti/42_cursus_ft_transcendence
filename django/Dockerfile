FROM python:3.10-slim

# Installer les dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Définir le répertoire de travail
WORKDIR /django

# Copier et installer les dépendances Python
COPY ./requirements.txt /django/requirements.txt
RUN pip install --no-cache-dir -r /django/requirements.txt

# Copier le code source
COPY ./src /django/src

# Définir les variables d’environnement
ENV DJANGO_SETTINGS_MODULE=transcendence.settings
ENV PYTHONPATH=/django/src
ENV PYTHONUNBUFFERED=1

# Collecter les fichiers statiques pour Nginx
RUN python src/main.py collectstatic --noinput

# Exposer le port pour Daphne (Nginx y accédera en interne)
EXPOSE 8000

# Lancer Daphne en mode production
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "transcendence.asgi:application"]