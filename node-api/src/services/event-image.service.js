import { lookup } from 'node:dns/promises'
import https from 'node:https'
import { isIP } from 'node:net'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_PIXELS = 40_000_000
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif'])
const ACCEPTED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

// Crea errores con un código HTTP para que el middleware central responda adecuadamente.
function fail(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

// Determina si una IP es pública; rechaza direcciones locales o reservadas.
function isPublicAddress(address) {
  const version = isIP(address)
  if (version === 4) {
    const octets = address.split('.').map(Number)
    const [a, b, c] = octets
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168) )
      || (a === 192 && b === 88 && c === 99)
      || (a === 198 && (b === 18 || b === 19 || b === 51))
      || (a === 203 && b === 0 && c === 113))
  }
  if (version === 6) {
    const normalized = address.toLowerCase()
    return normalized.startsWith('2') || normalized.startsWith('3')
      ? !normalized.startsWith('2001:db8:') && !normalized.startsWith('2001:10:')
      : false
  }
  return false
}

// Resuelve el host y rechaza el enlace si alguna dirección no es pública.
async function resolvePublicHost(hostname) {
  const version = isIP(hostname)
  let addresses
  try {
    addresses = version ? [{ address: hostname, family: version }] : await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw fail(400, 'No se pudo encontrar el servidor de la imagen.')
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw fail(400, 'El enlace de imagen apunta a una dirección no permitida.')
  }
  return addresses[0]
}

// Acepta solo enlaces HTTPS sin credenciales ni puertos alternativos.
function validateImageUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw fail(400, 'Ingresá un enlace válido a una imagen.')
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw fail(400, 'El enlace de imagen debe usar HTTPS y no incluir credenciales.')
  }
  return url
}

// Descarga una imagen verificando redirecciones, tipo de contenido y tamaño.
function requestImage(url, address) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      headers: { Accept: 'image/jpeg,image/png,image/webp,image/avif' },
      servername: isIP(url.hostname) ? undefined : url.hostname,
      lookup: (_hostname, options, callback) => {
        if (options?.all) {
          callback(null, [address])
          return
        }
        callback(null, address.address, address.family)
      },
    }, (response) => {
      const status = response.statusCode || 0
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location
        response.resume()
        resolve({ redirect: location })
        return
      }
      if (status !== 200) {
        response.resume()
        reject(fail(400, 'No se pudo descargar la imagen del enlace.'))
        return
      }

      const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      if (!ACCEPTED_CONTENT_TYPES.has(contentType)) {
        response.resume()
        reject(fail(400, 'El enlace no devuelve una imagen JPG, PNG, WebP o AVIF.'))
        return
      }
      const declaredLength = Number(response.headers['content-length'] || 0)
      if (declaredLength > MAX_IMAGE_BYTES) {
        response.destroy()
        reject(fail(413, 'La imagen del enlace supera el límite de 5 MB.'))
        return
      }

      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_IMAGE_BYTES) {
          response.destroy(fail(413, 'La imagen del enlace supera el límite de 5 MB.'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }))
      response.on('error', reject)
    })
    request.setTimeout(12_000, () => request.destroy(fail(408, 'El servidor de imágenes tardó demasiado en responder.')))
    request.on('error', reject)
    request.end()
  })
}

// Sigue hasta tres redirecciones y vuelve a validar cada destino antes de descargarlo.
async function downloadImage(value) {
  let url = validateImageUrl(value)
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const address = await resolvePublicHost(url.hostname)
    const result = await requestImage(url, address)
    if (result.buffer) return result.buffer
    if (!result.redirect || redirects === 3) throw fail(400, 'El enlace de imagen tiene demasiadas redirecciones.')
    url = validateImageUrl(new URL(result.redirect, url).toString())
  }
  throw fail(400, 'No se pudo descargar la imagen del enlace.')
}

// Convierte una fuente URL o archivo base64 en un buffer después de validarla.
function imageBufferFromSource(source) {
  if (source?.type === 'url') {
    if (typeof source.url !== 'string' || !source.url.trim()) throw fail(400, 'Falta el enlace de la imagen.')
    return downloadImage(source.url.trim())
  }
  if (source?.type === 'file') {
    const { base64, content_type: contentType } = source
    if (!ACCEPTED_CONTENT_TYPES.has(contentType)) throw fail(400, 'El archivo debe ser JPG, PNG, WebP o AVIF.')
    if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw fail(400, 'El archivo de imagen no es válido.')
    const buffer = Buffer.from(base64, 'base64')
    if (!buffer.length) throw fail(400, 'El archivo de imagen está vacío.')
    if (buffer.length > MAX_IMAGE_BYTES) throw fail(413, 'La imagen no puede superar los 5 MB.')
    return Promise.resolve(buffer)
  }
  throw fail(400, 'La fuente de imagen no es válida.')
}

// Comprueba la imagen, corrige su orientación, ajusta sus dimensiones y la convierte a WebP.
async function toWebp(input) {
  let metadata
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_PIXELS, animated: false }).metadata()
  } catch {
    throw fail(400, 'El archivo recibido no se pudo leer como imagen.')
  }
  if (!ACCEPTED_FORMATS.has(metadata.format)) throw fail(400, 'La imagen debe ser JPG, PNG, WebP o AVIF.')
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) {
    throw fail(400, 'La resolución de la imagen es demasiado grande.')
  }

  for (const quality of [82, 72, 62, 52]) {
    const output = await sharp(input, { limitInputPixels: MAX_PIXELS, animated: false })
      .rotate()
      .resize(1200, 675, { fit: 'cover', position: 'attention' })
      .webp({ quality, effort: 5 })
      .toBuffer()
    if (output.length <= MAX_IMAGE_BYTES) return output
  }
  throw fail(413, 'La imagen optimizada todavía supera el límite de 5 MB.')
}

// Lee la configuración necesaria para subir archivos al bucket de Supabase Storage.
function getStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = process.env.SUPABASE_EVENT_IMAGES_BUCKET || 'event-images'
  if (!supabaseUrl || !secretKey) {
    throw fail(503, 'La carga de imágenes aún no está configurada en el backend.')
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), secretKey, bucket }
}

// Prepara los encabezados de autenticación y tipo de contenido para Storage.
function storageHeaders(secretKey, contentType) {
  const headers = { apikey: secretKey }
  // New sb_secret keys are opaque API keys, not JWTs. A Bearer header would
  // make Storage try to parse them as JWTs; legacy service_role keys are JWTs.
  if (!secretKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secretKey}`
  if (contentType) headers['Content-Type'] = contentType
  return headers
}

// Valida, optimiza y sube la imagen; devuelve su ruta interna y su URL pública.
export async function processAndStoreEventImage(source, slug) {
  const input = await imageBufferFromSource(source)
  const webp = await toWebp(input)
  const { supabaseUrl, secretKey, bucket } = getStorageConfig()
  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 100) || 'evento'
  const path = `${safeSlug}/${randomUUID()}.webp`
  const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...storageHeaders(secretKey, 'image/webp'), 'x-upsert': 'false' },
    body: webp,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('Supabase Storage upload failed:', response.status, detail.slice(0, 300))
    throw fail(response.status === 413 ? 413 : 502, 'No se pudo guardar la imagen en el almacenamiento.')
  }
  return {
    path,
    url: `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`,
  }
}

// Elimina de Storage una imagen cuya carga ya no se necesita.
export async function deleteStoredImage(path) {
  const { supabaseUrl, secretKey, bucket } = getStorageConfig()
  const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: storageHeaders(secretKey),
  })
  if (!response.ok) throw new Error(`Storage cleanup failed: ${response.status}`)
}
