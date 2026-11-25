from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    # Importar las señales al iniciar la app registra sus receptores.
    def ready(self):
        from . import signals
