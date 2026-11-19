import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

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

export async function initializeDatabase() {
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
