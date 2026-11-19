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
