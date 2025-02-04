from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models

class UserManager(BaseUserManager):
    def create_user(self, nickname, password=None, elo=1000):
        if not nickname:
            raise ValueError("Le champ nickname est obligatoire")
        
        user = self.model(nickname=nickname, elo=elo)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, nickname, password=None):
        user = self.create_user(nickname, password)
        user.is_admin = True
        user.save(using=self._db)
        return user

class User(AbstractBaseUser):
    nickname = models.CharField(max_length=50, unique=True)
    elo = models.IntegerField(default=1000)

    objects = UserManager()

    USERNAME_FIELD = 'nickname'

    def __str__(self):
        return self.nickname
