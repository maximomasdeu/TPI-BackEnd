import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../config/db.js'
import { eventAlertMailConfigured } from '../services/event-alert-mailer.js'

const router = Router()
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

// Expone el estado del enlace de calendario con los datos que se pueden mostrar al público.
router.get('/events/:slug', async (request, response) => {
  response.set('Cache-Control', 'no-store')
  const { rows: [event] } = await pool.query(`
    SELECT status,
      CASE WHEN status IN ('published', 'rescheduled', 'suspended', 'past') THEN title END AS title,
      CASE WHEN status IN ('published', 'rescheduled', 'past') THEN start_at END AS start_at,
      CASE WHEN status IN ('published', 'rescheduled', 'past') THEN location END AS location,
      CASE WHEN status IN ('published', 'rescheduled', 'past') THEN city END AS city
    FROM events
    WHERE slug = $1 AND status IN ('published', 'rescheduled', 'suspended', 'past', 'cancelled', 'deleted')
  `, [request.params.slug])
  if (!event) return response.status(404).json({ message: 'Este evento no está disponible en la agenda.' })
  response.json(event)
})

// Registra la solicitud y encola el correo de confirmación en una sola operación.
router.post('/events/:slug', async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ message: 'Ingresá un correo válido.' })
  }
  if (!eventAlertMailConfigured()) {
    return response.status(503).json({ message: 'Los avisos por correo no están disponibles por el momento.' })
  }

  const { rows: [result] } = await pool.query(`
    WITH event AS (
      SELECT slug, title FROM events
      WHERE slug = $1 AND status IN ('published', 'rescheduled') AND end_at >= now()
    ), subscription AS (
      INSERT INTO event_alert_subscriptions (event_slug, email, token)
      SELECT slug, $2, $3 FROM event
      ON CONFLICT (event_slug, email) DO UPDATE SET requested_at = now()
      WHERE event_alert_subscriptions.confirmed_at IS NULL
        AND event_alert_subscriptions.requested_at < now() - interval '10 minutes'
      RETURNING token
    ), confirmation AS (
      INSERT INTO event_alert_emails (token, kind, title)
      SELECT subscription.token, 'confirm', event.title FROM subscription CROSS JOIN event
      ON CONFLICT DO NOTHING
    )
    SELECT EXISTS (SELECT FROM event) AS available
  `, [request.params.slug, email, randomUUID()])
  if (!result.available) {
    return response.status(404).json({ message: 'Este evento ya no admite nuevos avisos.' })
  }
  response.status(202).json({ message: 'Si falta confirmar tus avisos, vas a recibir un correo.' })
})

function managementPage(response, title, content) {
  response.set({
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
  })
  response.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Agenda Ciudad</title><main><h1>${title}</h1>${content}</main></html>`)
}

// GET muestra el formulario de confirmación o baja. Solo el POST cambia la suscripción.
router.route('/:token/:action')
  .all((request, response, next) => {
    if (!uuidPattern.test(request.params.token) || !['confirmar', 'baja'].includes(request.params.action)) {
      return response.sendStatus(404)
    }
    next()
  })
  .get((request, response) => {
    const label = request.params.action === 'confirmar' ? 'Confirmar avisos' : 'Dejar de recibir avisos'
    managementPage(response, label, `<form method="post"><button type="submit">${label}</button></form>`)
  })
  .post(async (request, response) => {
    const { token, action } = request.params
    if (action === 'baja') {
      await pool.query('DELETE FROM event_alert_subscriptions WHERE token = $1', [token])
      return managementPage(response, 'Baja confirmada', '<p>Ya no vas a recibir avisos sobre este evento.</p>')
    }
    const result = await pool.query(`
      UPDATE event_alert_subscriptions
      SET confirmed_at = COALESCE(confirmed_at, now())
      WHERE token = $1 AND (confirmed_at IS NOT NULL OR requested_at >= now() - interval '2 days')
    `, [token])
    if (!result.rowCount) {
      return managementPage(response.status(404), 'Enlace vencido o inválido', '<p>Podés volver a pedir avisos desde la agenda.</p>')
    }
    managementPage(response, 'Avisos confirmados', '<p>Vas a recibir un correo si cambia el evento.</p>')
  })

export default router
