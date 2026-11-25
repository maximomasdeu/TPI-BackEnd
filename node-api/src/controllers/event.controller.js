import { pool } from '../config/db.js'
import { deleteStoredImage, processAndStoreEventImage } from '../services/event-image.service.js'

// Responde al chequeo de disponibilidad sin consultar la base de datos.
export function healthCheck(request, response) {
  response.json({ ok: true, service: 'node-events-api' })
}

// Lista eventos ordenados por fecha y aplica filtros de estado y visibilidad.
export async function listEvents(request, response, next) {
  try {
    const includeDeleted = request.query.include_deleted === 'true'
    const requestedStatus = request.query.status
    if (includeDeleted && request.user?.role !== 'admin') {
      response.status(403).json({ message: 'Solo administración puede consultar eventos eliminados' })
      return
    }

    const result = await pool.query(
      includeDeleted
        ? requestedStatus
          ? 'SELECT * FROM events WHERE status = $1 ORDER BY start_at'
          : 'SELECT * FROM events ORDER BY start_at'
        : requestedStatus && !['deleted', 'cancelled'].includes(requestedStatus)
        ? 'SELECT * FROM events WHERE status = $1 ORDER BY start_at'
        : "SELECT * FROM events WHERE status NOT IN ('deleted', 'cancelled') ORDER BY start_at",
      includeDeleted && requestedStatus ? [requestedStatus] : (!includeDeleted && requestedStatus && !['deleted', 'cancelled'].includes(requestedStatus) ? [requestedStatus] : [])
    )
    response.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// Busca un evento por slug; los eliminados o cancelados solo son visibles para admin.
export async function getEvent(request, response, next) {
  try {
    const result = await pool.query(
      request.user?.role === 'admin'
        ? 'SELECT * FROM events WHERE slug = $1'
        : "SELECT * FROM events WHERE slug = $1 AND status NOT IN ('deleted', 'cancelled')",
      [request.params.slug]
    )
    if (!result.rows.length) {
      response.status(404).json({ message: 'Evento no encontrado' })
      return
    }
    response.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// Valida y crea una propuesta de evento, guardando su imagen si fue enviada.
export async function createEvent(request, response, next) {
  let storedImage = null
  try {
    const body = request.body
    const requiredFields = ['slug', 'title', 'category', 'description', 'start_at', 'end_at', 'location', 'city', 'organization']
    const missingField = requiredFields.find((field) => !String(body[field] || '').trim())
    if (missingField) {
      response.status(400).json({ message: `Falta el campo obligatorio: ${missingField}` })
      return
    }

    const imageSource = body.image_source || (body.image ? { type: 'url', url: body.image } : null)
    if (body.image_source && body.image) {
      const error = new Error('Elegí una sola fuente para la imagen del evento.')
      error.statusCode = 400
      throw error
    }
    storedImage = imageSource ? await processAndStoreEventImage(imageSource, body.slug) : null

    const result = await pool.query(
      `INSERT INTO events (
        slug, title, category, description, image, start_at, end_at,
        location, city, organization, organizer_email, ticket_type,
        price, ticket_url, status, submitted_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending',CURRENT_DATE
      ) RETURNING *`,
      [
        body.slug, body.title, body.category, body.description, storedImage?.url || null,
        body.start_at, body.end_at, body.location, body.city, body.organization,
        request.user.email, body.ticket_type || 'free', body.price || null, body.ticket_url || null,
      ]
    )
    response.status(201).json(result.rows[0])
  } catch (error) {
    if (storedImage?.path) await deleteStoredImage(storedImage.path).catch(() => {})
    if (error.code === '23505') {
      response.status(409).json({ message: 'Ya existe un evento con ese slug' })
      return
    }
    next(error)
  }
}

// Permite al organizador dueño corregir una propuesta que recibió pedido de cambios.
export async function updateEventDetails(request, response, next) {
  let storedImage = null
  try {
    if (request.user.role !== 'organizer') {
      response.status(403).json({ message: 'Solo un organizador puede modificar su propuesta' })
      return
    }

    const body = request.body
    const requiredFields = ['title', 'category', 'description', 'start_at', 'end_at', 'location', 'city', 'organization']
    const missingField = requiredFields.find((field) => !String(body[field] || '').trim())
    if (missingField) {
      response.status(400).json({ message: `Falta el campo obligatorio: ${missingField}` })
      return
    }

    const current = await pool.query(
      `SELECT * FROM events
       WHERE slug = $1 AND organizer_email = $2`,
      [request.params.slug, request.user.email]
    )
    if (!current.rows.length) {
      response.status(404).json({ message: 'Evento no encontrado o sin permiso' })
      return
    }
    if (current.rows[0].status !== 'changes_requested') {
      response.status(400).json({ message: 'Solo se pueden modificar eventos con cambios solicitados' })
      return
    }

    if (body.image_source) {
      storedImage = await processAndStoreEventImage(body.image_source, request.params.slug)
    }

    const result = await pool.query(
      `UPDATE events
       SET title = $1,
           category = $2,
           description = $3,
           image = COALESCE($4, image),
           start_at = $5,
           end_at = $6,
           location = $7,
           city = $8,
           organization = $9,
           ticket_type = $10,
           price = $11,
           ticket_url = $12,
           status = 'pending',
           review_note = ''
       WHERE slug = $13 AND organizer_email = $14
       RETURNING *`,
      [
        body.title,
        body.category,
        body.description,
        storedImage?.url || null,
        body.start_at,
        body.end_at,
        body.location,
        body.city,
        body.organization,
        body.ticket_type || 'free',
        body.price || null,
        body.ticket_url || null,
        request.params.slug,
        request.user.email,
      ]
    )
    response.json(result.rows[0])
  } catch (error) {
    if (storedImage?.path) await deleteStoredImage(storedImage.path).catch(() => {})
    next(error)
  }
}

// Cambia el estado del evento y, si corresponde, registra sus fechas anteriores.
export async function updateEventStatus(request, response, next) {
  try {
    const allowedStatuses = ['pending', 'changes_requested', 'published', 'rejected', 'suspended', 'rescheduled', 'cancelled', 'past']
    const status = request.body.status
    const isAdmin = request.user.role === 'admin'
    const organizerStatuses = ['rescheduled', 'cancelled']
    if (!allowedStatuses.includes(status) || (!isAdmin && !organizerStatuses.includes(status))) {
      response.status(400).json({ message: 'Estado inválido' })
      return
    }

    const result = await pool.query(
      `UPDATE events
       SET status = $1,
           review_note = $2,
           previous_start_at = CASE
             WHEN $3::timestamptz IS NOT NULL AND start_at IS DISTINCT FROM $3::timestamptz
             THEN start_at ELSE previous_start_at END,
           previous_end_at = CASE
             WHEN $4::timestamptz IS NOT NULL AND end_at IS DISTINCT FROM $4::timestamptz
             THEN end_at ELSE previous_end_at END,
           start_at = COALESCE($3::timestamptz, start_at),
           end_at = COALESCE($4::timestamptz, end_at)
       WHERE slug = $5
         AND ($6 OR organizer_email = $7)
       RETURNING *`,
      [
        status,
        request.body.review_note || '',
        request.body.start_at || null,
        request.body.end_at || null,
        request.params.slug,
        isAdmin,
        request.user.email,
      ]
    )
    if (!result.rows.length) {
      response.status(404).json({ message: 'Evento no encontrado' })
      return
    }
    response.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// El organizador elimina su propuesta; admin realiza una baja lógica con motivo.
export async function deleteEvent(request, response, next) {
  try {
    if (request.user.role === 'admin') {
      const reason = String(request.body?.reason || '').trim()
      if (!reason) {
        response.status(400).json({ message: 'El motivo de eliminación es obligatorio' })
        return
      }

      const result = await pool.query(
        `UPDATE events
         SET status = 'deleted', review_note = $1
         WHERE slug = $2 AND status IN ('published', 'rescheduled')
         RETURNING *`,
        [reason, request.params.slug]
      )
      if (!result.rows.length) {
        response.status(404).json({ message: 'Evento no encontrado' })
        return
      }
      response.json(result.rows[0])
      return
    }

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
}
