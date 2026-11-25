#!/usr/bin/env python
import os
import sys
from dotenv import load_dotenv

# Carga el archivo .env antes de que Django lea su configuración.
load_dotenv()


# Prepara Django y ejecuta el comando recibido por consola.
def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
