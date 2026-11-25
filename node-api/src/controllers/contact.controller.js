import { pool } from '../config/db.js'

// Devuelve los mensajes de contacto ordenados de más recientes a más antiguos.
export async function listContactMessages(request, response, next) {
  try {
    if (request.user?.role !== 'admin') {
      response.status(403).json({ message: 'Solo administración puede ver las consultas' })
      return
    }

    const result = await pool.query(
      `SELECT id, name, email, subject, message, submitted_at
       FROM contact_messages
       ORDER BY submitted_at DESC, id DESC`
    )
    response.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// Valida y guarda un mensaje enviado desde el formulario público de contacto.
export async function createContactMessage(request, response, next) {
  try {
    const name = String(request.body.name || '').trim()
    const email = String(request.body.email || '').trim().toLowerCase()
    const subject = String(request.body.subject || '').trim()
    const message = String(request.body.message || '').trim()

    if (!name || !email || !subject || !message) {
      response.status(400).json({ message: 'Nombre, correo, asunto y mensaje son obligatorios' })
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
      [name, email, subject, message]
    )
    response.status(201).json({ message: 'Mensaje enviado correctamente', ...result.rows[0] })
  } catch (error) {
    next(error)
  }
}