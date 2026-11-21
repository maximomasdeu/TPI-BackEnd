# Imágenes de eventos

## Configuración de Supabase

1. El bucket `event-images` ya quedó creado como público para lectura, limitado a `image/webp` y `5 MB`. Las tarjetas de eventos se ven sin iniciar sesión; el backend conserva la clave secreta y es el único que sube o elimina archivos.
2. Completar las variables del entorno del backend:

   ```env
   SUPABASE_URL=https://PROJECT_REF.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   SUPABASE_EVENT_IMAGES_BUCKET=event-images
   ```

La clave secreta va únicamente en el backend (localmente, en `node-api/.env`; en producción, en las variables privadas del servicio). No debe ponerse en variables `VITE_*`, el navegador ni el repositorio.

## Comportamiento

- El formulario permite elegir un enlace HTTPS o un archivo JPG, PNG, WebP o AVIF, nunca ambos.
- El backend limita cada origen a 5 MiB, comprueba el contenido y procesa el enlace en el servidor.
- Las imágenes nuevas se convierten a WebP, se recortan a 1200 × 675 y se guardan en el bucket.
- La base de datos guarda la URL pública del objeto resultante en `events.image`.
- Las filas existentes y sus URLs no se migran ni se modifican. No hace falta una migración de base de datos.
