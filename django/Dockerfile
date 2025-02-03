# Utilise l'image officielle de Python 3.10 (la version la plus récente et stable pour Django)
FROM python:3.10-slim

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie le fichier requirements.txt dans le conteneur
COPY ./requirements.txt /app/requirements.txt

# Installe les dépendances Python
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copie le reste du code source de l'application dans le conteneur
COPY ./src /app/src

# Définit la variable d'environnement pour Django
ENV DJANGO_SETTINGS_MODULE=transcendence.settings

# Expose le port 8000 pour l'application Django
EXPOSE 8000

# Commande pour démarrer le serveur Django
CMD ["python", "src/main.py", "runserver", "0.0.0.0:8000"]