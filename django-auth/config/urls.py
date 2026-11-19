from django.urls import path
from accounts.views import profile, register, login

urlpatterns = [
    path('api/auth/register/', register),
    path('api/auth/login/', login),
    path('api/auth/profile/', profile),
]
