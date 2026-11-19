import express from 'express'
import jwt from 'jsonwebtoken'
import pg from 'pg'

const app = express()
const { Pool } = pg
const port = Number(process.env.PORT || 3000)
const jwtSecret = process.env.JWT_SECRET

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
})

app.use(express.json())
app.use((request, response, next) => {
  response.header('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  if (request.method === 'OPTIONS') {
    response.sendStatus(204)
    return
  }
  next()
})

async function requireLogin(request, response, next) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Se requiere iniciar sesión' })
    return
  }

  try {
    request.user = jwt.verify(authorization.slice(7), jwtSecret)
    next()
  } catch {
    response.status(401).json({ message: 'Sesión inválida' })
  }
}

app.get('/health', (request, response) => {
  response.json({ ok: true, service: 'node-events-api' })
})

app.get('/events', async (request, response, next) => {
  try {
    const result = await pool.query(
      request.query.status
        ? 'SELECT * FROM events WHERE status = $1 ORDER BY start_at'
        : 'SELECT * FROM events ORDER BY start_at',
      request.query.status ? [request.query.status] : []
    )
    response.json(result.rows)
  } catch (error) {
    next(error)
  }
})

app.get('/events/:slug', async (request, response, next) => {
  try {
    const result = await pool.query('SELECT * FROM events WHERE slug = $1', [request.params.slug])
    if (!result.rows.length) {
      response.status(404).json({ message: 'Evento no encontrado' })
      return
    }
    response.json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

app.post('/events', requireLogin, async (request, response, next) => {
  try {
    const body = request.body
    const requiredFields = ['slug', 'title', 'category', 'description', 'start_at', 'end_at', 'location', 'city', 'organization']
    const missingField = requiredFields.find((field) => !String(body[field] || '').trim())
    if (missingField) {
      response.status(400).json({ message: `Falta el campo obligatorio: ${missingField}` })
      return
    }

    const result = await pool.query(
      `INSERT INTO events (
        slug, title, category, description, image, start_at, end_at,
        location, city, organization, organizer_email, ticket_type,
        price, ticket_url, status, submitted_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending',CURRENT_DATE
      ) RETURNING *`,
      [
        body.slug, body.title, body.category, body.description, body.image || null,
        body.start_at, body.end_at, body.location, body.city, body.organization,
        request.user.email, body.ticket_type || 'free', body.price || null, body.ticket_url || null,
      ]
    )
    response.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === '23505') {
      response.status(409).json({ message: 'Ya existe un evento con ese slug' })
      return
    }
    next(error)
  }
})

app.patch('/events/:slug/status', requireLogin, async (request, response, next) => {
  try {
    if (request.user.role !== 'admin') {
      response.status(403).json({ message: 'Solo un administrador puede cambiar estados' })
      return
    }

    const allowedStatuses = ['pending', 'changes_requested', 'published', 'rejected', 'suspended', 'rescheduled', 'cancelled', 'past']
    if (!allowedStatuses.includes(request.body.status)) {
      response.status(400).json({ message: 'Estado inválido' })
      return
    }

    const result = await pool.query(
      'UPDATE events SET status = $1, review_note = $2 WHERE slug = $3 RETURNING *',
      [request.body.status, request.body.review_note || '', request.params.slug]
    )
    if (!result.rows.length) {
      response.status(404).json({ message: 'Evento no encontrado' })
      return
    }
    response.json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

app.delete('/events/:slug', requireLogin, async (request, response, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM events WHERE slug = $1 AND organizer_email = $2 RETURNING slug',
      [request.params.slug, request.user.email]
    )
    if (!result.rows.length) {
      response.status(404).json({ message: 'Evento no encontrado o sin permiso' })
      return
    }
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

app.use((error, request, response, next) => {
  console.error(error)
  response.status(500).json({ message: 'Error interno del servidor' })
})

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      slug VARCHAR(200) UNIQUE NOT NULL,
      title VARCHAR(200) NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      image TEXT,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      location VARCHAR(200) NOT NULL,
      city VARCHAR(200) NOT NULL,
      organization VARCHAR(200) NOT NULL,
      organizer_email VARCHAR(254) NOT NULL,
      ticket_type VARCHAR(20) NOT NULL DEFAULT 'free',
      price VARCHAR(100),
      ticket_url TEXT,
      previous_start_at TIMESTAMPTZ,
      previous_end_at TIMESTAMPTZ,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      review_note TEXT,
      submitted_at DATE NOT NULL DEFAULT CURRENT_DATE
    )
  `)
}

initializeDatabase()
  .then(() => app.listen(port, () => console.log(`Node API activa en http://localhost:${port}`)))
  .catch((error) => {
    console.error('No se pudo iniciar la API:', error.message)
    process.exit(1)
  })
