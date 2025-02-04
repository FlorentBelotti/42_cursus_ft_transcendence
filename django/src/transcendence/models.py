from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    elo = models.IntegerField(default=1000)

    def __str__(self):
        return self.username