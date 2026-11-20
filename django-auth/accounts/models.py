from django.contrib.auth.models import User
from django.db import models


class Profile(models.Model):
    ROLE_CHOICES = (
        ('visitor', 'Visitante'),
        ('organizer', 'Organizador'),
        ('admin', 'Administrador'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=50, blank=True)
    organization = models.CharField(max_length=200, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='organizer')


class Organization(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='organizations')
    name = models.CharField(max_length=200)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ('-is_primary', 'name')
        constraints = (
            models.UniqueConstraint(fields=('profile', 'name'), name='unique_organization_per_profile'),
        )


class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    event_slug = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = (
            models.UniqueConstraint(fields=('user', 'event_slug'), name='unique_favorite_per_user'),
        )
