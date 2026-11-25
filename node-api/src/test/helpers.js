process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test'
process.env.JWT_SECRET ||= 'test-secret'

// Carga la aplicación y sus dependencias después de preparar el entorno de pruebas.
const [{ default: app }, { pool }, { default: jwt }] = await Promise.all([
  import('../../app.js'),
  import('../config/db.js'),
  import('jsonwebtoken'),
])

export const organizer = { email: 'organizer@example.com', role: 'organizer' }
export const admin = { email: 'admin@example.com', role: 'admin' }

// Genera el encabezado Bearer que representa al usuario indicado.
export function auth(user = organizer) {
  return { authorization: `Bearer ${jwt.sign(user, process.env.JWT_SECRET)}` }
}

// Levanta un servidor temporal y sustituye la consulta SQL para aislar cada prueba.
export async function withApi(query, callback, { quietErrors = false } = {}) {
  const originalQuery = pool.query
  const originalConsoleError = console.error
  pool.query = query
  if (quietErrors) console.error = () => {}
  const server = app.listen(0)

  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    const { port } = server.address()
    await callback(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    pool.query = originalQuery
    console.error = originalConsoleError
  }
}

// Hace una request HTTP de prueba y devuelve el status junto con el JSON de respuesta.
export async function request(baseUrl, path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}
