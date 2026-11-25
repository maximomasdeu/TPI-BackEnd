from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    # Primera migración de accounts: crea el perfil vinculado al usuario de Django.
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # El usuario se mantiene en el modelo de autenticación de Django.
        migrations.CreateModel(
            name='Profile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('phone', models.CharField(blank=True, max_length=50)),
                ('organization', models.CharField(blank=True, max_length=200)),
                ('role', models.CharField(choices=[('visitor', 'Visitante'), ('organizer', 'Organizador'), ('admin', 'Administrador')], default='organizer', max_length=20)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
