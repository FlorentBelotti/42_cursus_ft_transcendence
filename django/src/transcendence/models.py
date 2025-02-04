from django.db import models

class User(models.Model):
    nickname = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nickname
