import { pool } from '../config/db.js'

export async function createContactMessage(request, response, next) {
  try {
    const name = String(request.body.name || '').trim()
    const email = String(request.body.email || '').trim().toLowerCase()
    const subject = String(request.body.subject || '').trim()
    const message = String(request.body.message || '').trim()

    if (!name || !email || !message) {
      response.status(400).json({ message: 'Nombre, correo y mensaje son obligatorios' })
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      response.status(400).json({ message: 'El correo electrónico no es válido' })
      return
    }

    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, submitted_at`,
      [name, email, subject || null, message]
    )
    response.status(201).json({ message: 'Mensaje enviado correctamente', ...result.rows[0] })
  } catch (error) {
    next(error)
  }
}