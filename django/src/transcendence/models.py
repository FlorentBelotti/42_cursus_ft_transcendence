from django.db import models

class User(models.Model):
    nickname = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    elo = models.IntegerField(default=1000)
    last_login = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.nickname
