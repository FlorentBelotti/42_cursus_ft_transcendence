from django.db import models
import uuid
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from django.db import models
import time

class customUser(AbstractUser):
	email = models.EmailField(unique=True)
	profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True, default='profile_pictures/arcane_from_arcane.png')
	elo = models.IntegerField(default=1000)
	wins = models.IntegerField(default=0)
	losses = models.IntegerField(default=0)
	friends = models.ManyToManyField("self", blank=True)
	nickname = models.CharField(max_length=30, blank=True, null=True)
	history = models.JSONField(default=list, blank=True)
	last_seen = models.DateTimeField(default=timezone.now)
	snake_high_score = models.IntegerField(default=0)

	def update_last_seen(self):
		self.last_seen = timezone.now()
		self.save()

	def is_online(self):
		delta = timezone.now() - self.last_seen
		return delta.total_seconds() < 120

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

def get_expiration_time():
	return timezone.now() + timezone.timedelta(minutes=5)

class GameInvitation(models.Model):
	MATCH_TYPES = (
		('regular', 'Regular Match'),
		('tournament', 'Tournament'),
	)

	STATUS_CHOICES = (
		('pending', 'Pending'),
		('accepted', 'Accepted'),
		('declined', 'Declined'),
		('expired', 'Expired'),
	)

	# Who sent the invitation
	sender = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='sent_invitations'
	)

	# Who received the invitation
	recipient = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='received_invitations'
	)

	# When the invitation was created
	created_at = models.DateTimeField(auto_now_add=True)

	# What type of match
	match_type = models.CharField(max_length=15, choices=MATCH_TYPES, default='regular')

	# Current status of the invitation
	status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

	# Optional game ID if needed to connect to a specific game
	game_id = models.CharField(max_length=100, blank=True, null=True)

	# When the invitation expires (default to 5 minutes)
	expires_at = models.DateTimeField(default=get_expiration_time)

	def is_expired(self):
		return timezone.now() > self.expires_at

	def expire_if_needed(self):
		if self.is_expired() and self.status == 'pending':
			self.status = 'expired'
			self.save()
			return True
		return False

	def __str__(self):
		return f"Invitation from {self.sender} to {self.recipient} for {self.match_type} match"
