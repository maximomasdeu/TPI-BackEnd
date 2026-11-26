import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { initializeEventAlerts } from './event-alerts.js'

const { Pool } = pg

// Evita iniciar la API sin una conexión explícita a PostgreSQL.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

// Arma la configuración SSL y carga el certificado de la CA cuando se requiere.
function getSslConfig() {
  if (process.env.DB_SSLMODE !== 'require') return false

  if (!process.env.DB_SSL_CA) {
    throw new Error('DB_SSL_CA is required when DB_SSLMODE=require')
  }

  return {
    rejectUnauthorized: true,
    ca: readFileSync(resolve(process.cwd(), process.env.DB_SSL_CA), 'utf8'),
  }
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSslConfig(),
})

// Crea las tablas necesarias si todavía no existen.
export async function initializeDatabase() {
  // Eventos publicados o propuestos por los organizadores.
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
  // Efemérides con una fecha anual expresada por día y mes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anniversaries (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      organization VARCHAR(200) NOT NULL,
      image TEXT,
      organizer_email VARCHAR(254) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      review_note TEXT,
      submitted_at DATE NOT NULL DEFAULT CURRENT_DATE
    )
  `)
  // Mensajes enviados desde el formulario de contacto.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(254) NOT NULL,
      subject VARCHAR(200),
      message TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'unread',
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await initializeEventAlerts(pool)
}
