import os
from pathlib import Path

# Directorio raíz del proyecto Django.
BASE_DIR = Path(__file__).resolve().parent.parent

# La aplicación no arranca sin una clave secreta configurada en el entorno.
SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError('SECRET_KEY is required')

# Opciones generales del servidor, configurables desde el entorno.
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = [host.strip() for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if host.strip()]

# Aplicaciones de Django necesarias y aplicación propia de cuentas.
INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'accounts',
]

# Middleware activo para seguridad y tratamiento común de requests.
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

# Archivo que declara las rutas HTTP del proyecto.
ROOT_URLCONF = 'config.urls'

# Conexión a PostgreSQL; los datos se obtienen de variables de entorno.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'postgres'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

# Solicita conexión SSL cuando DB_SSLMODE está definido.
if os.getenv('DB_SSLMODE'):
    DATABASES['default']['OPTIONS'] = {'sslmode': os.getenv('DB_SSLMODE')}

# Valores por defecto del ORM y configuración regional.
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LANGUAGE_CODE = 'es-ar'
TIME_ZONE = 'America/Argentina/Buenos_Aires'
USE_I18N = True
USE_TZ = True
