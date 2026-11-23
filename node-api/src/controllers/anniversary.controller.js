import { pool } from '../config/db.js'
import { deleteStoredImage, processAndStoreEventImage } from '../services/event-image.service.js'

export async function listAnniversaries(request, response, next) {
  try {
    const includeDeleted = request.query.include_deleted === 'true'
    const requestedStatus = request.query.status
    if (includeDeleted && request.user?.role !== 'admin') {
      response.status(403).json({ message: 'Solo administración puede consultar efemérides eliminadas' })
      return
    }

    const result = await pool.query(
      includeDeleted
        ? requestedStatus
          ? 'SELECT * FROM anniversaries WHERE status = $1 ORDER BY month, day, submitted_at'
          : 'SELECT * FROM anniversaries ORDER BY month, day, submitted_at'
        : requestedStatus && !['deleted', 'cancelled'].includes(requestedStatus)
          ? 'SELECT * FROM anniversaries WHERE status = $1 ORDER BY month, day, submitted_at'
          : "SELECT * FROM anniversaries WHERE status NOT IN ('deleted', 'cancelled') ORDER BY month, day, submitted_at",
      includeDeleted && requestedStatus ? [requestedStatus] : (!includeDeleted && requestedStatus && !['deleted', 'cancelled'].includes(requestedStatus) ? [requestedStatus] : [])
    )
    response.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export async function getAnniversary(request, response, next) {
  try {
    const result = await pool.query(
      request.user?.role === 'admin'
        ? 'SELECT * FROM anniversaries WHERE id = $1'
        : "SELECT * FROM anniversaries WHERE id = $1 AND status NOT IN ('deleted', 'cancelled')",
      [request.params.id]
    )
    if (!result.rows.length) {
      response.status(404).json({ message: 'Efeméride no encontrada' })
      return
    }
    response.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export async function createAnniversary(request, response, next) {
  let storedImage = null
  try {
    const body = request.body
    const requiredFields = ['title', 'description', 'day', 'month', 'organization']
    const missingField = requiredFields.find((field) => !String(body[field] || '').trim())
    if (missingField) {
      response.status(400).json({ message: `Falta el campo obligatorio: ${missingField}` })
      return
    }

    const day = Number(body.day)
    const month = Number(body.month)
    if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(month) || month < 1 || month > 12) {
      response.status(400).json({ message: 'El día o el mes no son válidos' })
      return
    }

    if (body.image_source && body.image) {
      const error = new Error('Elegí una sola fuente para la imagen de la efeméride.')
      error.statusCode = 400
      throw error
    }
    if (body.image_source) {
      const imageSlug = `efemeride-${month}-${day}-${body.title}`
      storedImage = await processAndStoreEventImage(body.image_source, imageSlug)
    }

    const result = await pool.query(
      `INSERT INTO anniversaries (
        title, description, day, month, organization, image,
        organizer_email, status, submitted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',CURRENT_DATE)
      RETURNING *`,
      [
        body.title, body.description, day, month, body.organization,
        storedImage?.url || body.image || null, request.user.email,
      ]
    )
    response.status(201).json(result.rows[0])
  } catch (error) {
    if (storedImage?.path) await deleteStoredImage(storedImage.path).catch(() => {})
    next(error)
  }
}

export async function updateAnniversaryStatus(request, response, next) {
  try {
    const allowedStatuses = ['pending', 'changes_requested', 'published', 'rejected']
    const status = request.body.status
    if (!allowedStatuses.includes(status) || request.user.role !== 'admin') {
      response.status(400).json({ message: 'Estado inválido' })
      return
    }

    const result = await pool.query(
      `UPDATE anniversaries
      SET status = $1, review_note = $2
      WHERE id = $3
       RETURNING *`,
      [status, request.body.review_note || '', request.params.id]
    )
    if (!result.rows.length) {
      response.status(404).json({ message: 'Efeméride no encontrada' })
      return
    }
    response.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export async function deleteAnniversary(request, response, next) {
  try {
    if (request.user.role === 'admin') {
      const reason = String(request.body?.reason || '').trim()
      if (!reason) {
        response.status(400).json({ message: 'El motivo de eliminación es obligatorio' })
        return
      }

      const result = await pool.query(
        `UPDATE anniversaries
         SET status = 'deleted', review_note = $1
         WHERE id = $2 AND status = 'published'
         RETURNING *`,
        [reason, request.params.id]
      )
      if (!result.rows.length) {
        response.status(404).json({ message: 'Efeméride no encontrada o no está publicada' })
        return
      }
      response.json(result.rows[0])
      return
    }

    const result = await pool.query(
      'DELETE FROM anniversaries WHERE id = $1 AND organizer_email = $2 RETURNING id',
      [request.params.id, request.user.email]
    )
    if (!result.rows.length) {
      response.status(404).json({ message: 'Efeméride no encontrada o sin permiso' })
      return
    }
    response.status(204).send()
  } catch (error) {
    next(error)
  }
}
