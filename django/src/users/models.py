from django.db import models
import uuid
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from django.db import models

class customUser(AbstractUser):
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True, default='profile_pictures/arcane_from_arcane.png')
    elo = models.IntegerField(default=1000)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    friends = models.ManyToManyField("self", blank=True)
    nickname = models.CharField(max_length=30, blank=True, null=True)

    def __str__(self):
        return self.username

class VerificationCode(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    code = models.UUIDField(default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        return (timezone.now() - self.created_at).total_seconds() > 600

    def __str__(self):
        return f"{self.user.username} - {self.code}"