import { pool } from '../config/db.js'

// Habilita el envío cuando están configurados la clave, el remitente y la URL de Node.
export function eventAlertMailConfigured() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  return Boolean(
    apiKey && !/^re_(tu_clave|your_api_key|x+)$/i.test(apiKey)
      && process.env.EVENT_ALERT_FROM?.trim()
      && process.env.EVENT_ALERT_API_URL?.trim()
  )
}

const notices = {
  cancelled: 'El evento fue cancelado.',
  deleted: 'El evento fue retirado de la agenda.',
  removed: 'El evento fue retirado de la agenda.',
  suspended: 'El evento fue suspendido.',
  changed: 'Cambió la fecha, el horario o el lugar del evento.',
  updated: 'Hay una actualización publicada para el evento.',
}

// Arma el correo de confirmación o aviso y lo entrega a la API de Resend.
async function sendEmail(job) {
  const apiUrl = process.env.EVENT_ALERT_API_URL.replace(/\/$/, '')
  const frontendUrl = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
  const statusUrl = `${frontendUrl}/eventos/${encodeURIComponent(job.event_slug)}/estado`
  const manageUrl = `${apiUrl}/event-alerts/${job.token}`
  const confirmation = job.kind === 'confirm'
  const message = confirmation
    ? `Confirmá que querés recibir avisos sobre «${job.title}»:\n${manageUrl}/confirmar\n\nConsultar estado actualizado: ${statusUrl}\n\nSi no pediste avisos, podés ignorar este correo.`
    : `${job.title}\n\n${notices[job.kind]}\n\nConsultar estado actualizado: ${statusUrl}\n\nDejar de recibir avisos: ${manageUrl}/baja`

  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `agenda-event-alert/${job.id}/${job.token}`,
    },
    body: JSON.stringify({
      from: process.env.EVENT_ALERT_FROM,
      to: [job.email],
      subject: confirmation ? 'Confirmá tus avisos de Agenda Ciudad' : 'Novedad de un evento en Agenda Ciudad',
      text: message,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!result.ok) throw new Error(`Resend respondió HTTP ${result.status}`)
}

export async function processEventAlertEmail() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Bloquea un correo por intento para que dos instancias no lo procesen a la vez.
    const { rows: [job] } = await client.query(`
      SELECT e.id, e.kind, e.title, s.token, s.email, s.event_slug, s.confirmed_at
      FROM event_alert_emails e
      JOIN event_alert_subscriptions s ON s.token = e.token
      WHERE e.next_attempt_at <= now()
      ORDER BY e.id
      LIMIT 1
      FOR UPDATE OF e SKIP LOCKED
    `)
    if (job) {
      let sent = true
      try {
        if (job.kind !== 'confirm' || !job.confirmed_at) await sendEmail(job)
      } catch (error) {
        sent = false
        console.error('No se pudo enviar el aviso:', error.message)
      }
      if (sent) await client.query('DELETE FROM event_alert_emails WHERE id = $1', [job.id])
      else await client.query("UPDATE event_alert_emails SET next_attempt_at = now() + interval '5 minutes' WHERE id = $1", [job.id])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Programa el próximo ciclo después de que termine el actual.
export function startEventAlertMailer() {
  if (!eventAlertMailConfigured()) return

  async function sendNext() {
    try {
      await processEventAlertEmail()
    } catch (error) {
      console.error('No se pudo procesar la cola de avisos:', error.message)
    } finally {
      setTimeout(sendNext, 2000).unref()
    }
  }

  void sendNext()
}
