from django.urls import path
from accounts.views import favorites, profile, register, login

# Enruta cada endpoint de autenticación o favoritos a su vista correspondiente.
urlpatterns = [
    path('api/auth/register/', register),
    path('api/auth/login/', login),
    path('api/auth/profile/', profile),
    path('api/auth/favorites/', favorites),
]
