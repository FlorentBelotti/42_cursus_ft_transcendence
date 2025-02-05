from django.db import models

class User(models.Model):
    nickname = models.CharField(max_length=20, unique=True)
    password = models.CharField(max_length=255)
    elo = models.IntegerField(default=1000)

    def __str__(self):
        return self.nickname
