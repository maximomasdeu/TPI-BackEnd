import { pool } from '../src/config/db.js'
import { upcomingAnniversaries } from '../../../TPIFINAL/src/data/upcomingAnniversaries.js'

// Identifica las efemérides administradas por este seed.
const organizerEmail = 'contenido@agenda-ciudad.local'
let inserted = 0
let updated = 0
let skipped = 0

try {
  for (const { title, description, day, month, organization, image } of upcomingAnniversaries) {
    const values = [title, description, day, month, organization, image, organizerEmail]
    // Actualiza primero la efeméride existente que pertenece a este seed.
    const existing = await pool.query(
      `UPDATE anniversaries
      SET title = $1, description = $2, organization = $5, image = $6, status = 'published'
      WHERE day = $3 AND month = $4 AND organizer_email = $7
        AND status NOT IN ('deleted', 'cancelled')
      RETURNING id`,
      values
    )
    if (existing.rowCount) {
      updated += 1
      continue
    }

    // Si no es propia, inserta solo cuando no exista otra efeméride activa para esa fecha.
    const created = await pool.query(
      `INSERT INTO anniversaries (
        title, description, day, month, organization, image,
        organizer_email, status, submitted_at
      )
      SELECT $1,$2,$3,$4,$5,$6,$7,'published',CURRENT_DATE
      WHERE NOT EXISTS (
        SELECT 1 FROM anniversaries
        WHERE day = $3 AND month = $4 AND status NOT IN ('deleted', 'cancelled')
      )
      RETURNING id`,
      values
    )
    if (created.rowCount) inserted += 1
    else skipped += 1
  }

  process.stdout.write(`Efemérides nuevas: ${inserted}; actualizadas: ${updated}; ya existentes de otras propuestas: ${skipped}.\n`)
} catch (error) {
  process.stderr.write(`No se pudieron cargar las efemérides: ${error.message || error.code || error.name}\n`)
  process.exitCode = 1
} finally {
  await pool.end()
}
