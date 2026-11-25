import assert from 'node:assert/strict'
import { test } from 'node:test'
import { admin, auth, organizer, request, withApi } from './helpers.js'

// Casos de API para lectura, creación, edición, moderación y eliminación de eventos.
const event = {
  slug: 'evento-prueba',
  title: 'Evento de prueba',
  category: 'Cultura',
  description: 'Descripcion',
  start_at: '2026-12-01T18:00:00Z',
  end_at: '2026-12-01T20:00:00Z',
  location: 'Teatro',
  city: 'Goya',
  organization: 'Club',
  status: 'pending',
}

test('GET /events lista eventos visibles y admite filtro de estado', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /FROM events WHERE status = ANY\(\$1::text\[\]\) AND status = \$2/)
    assert.deepEqual(values, [['published', 'suspended', 'rescheduled', 'past'], 'published'])
    return { rows: [{ ...event, status: 'published' }] }
  }, async (url) => {
    const result = await request(url, '/events?status=published')
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, [{ ...event, status: 'published' }])
  })
})

test('GET /events/:slug obtiene por slug y responde 404 si no existe', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /WHERE slug = \$1/)
    assert.deepEqual(values, ['evento-prueba', ['published', 'suspended', 'rescheduled', 'past'], organizer.email])
    return { rows: [event] }
  }, async (url) => {
    const result = await request(url, '/events/evento-prueba', { headers: auth() })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, event)
  })

  await withApi(async () => ({ rows: [] }), async (url) => {
    const result = await request(url, '/events/no-existe')
    assert.equal(result.status, 404)
    assert.equal(result.body.message, 'Evento no encontrado')
  })
})

test('POST /events crea un evento, exige autenticacion y valida datos y slug duplicado', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /INSERT INTO events/)
    assert.equal(values[0], event.slug)
    assert.equal(values[10], organizer.email)
    return { rows: [event] }
  }, async (url) => {
    const result = await request(url, '/events', { method: 'POST', body: event, headers: auth() })
    assert.equal(result.status, 201)
    assert.deepEqual(result.body, event)
  })

  await withApi(async () => assert.fail('Datos inválidos no deben consultar la base'), async (url) => {
    const invalid = await request(url, '/events', { method: 'POST', body: { title: 'Incompleto' }, headers: auth() })
    assert.equal(invalid.status, 400)
    assert.match(invalid.body.message, /Falta el campo obligatorio/)
    const duplicateImages = await request(url, '/events', { method: 'POST', body: { ...event, image: 'https://example.com/a.jpg', image_source: { type: 'url', url: 'https://example.com/b.jpg' } }, headers: auth() })
    assert.equal(duplicateImages.status, 400)
    const unauthorized = await request(url, '/events', { method: 'POST', body: event })
    assert.equal(unauthorized.status, 401)
  }, { quietErrors: true })

  await withApi(async () => { const error = new Error('duplicate'); error.code = '23505'; throw error }, async (url) => {
    const result = await request(url, '/events', { method: 'POST', body: event, headers: auth() })
    assert.equal(result.status, 409)
    assert.equal(result.body.message, 'Ya existe un evento con ese slug')
  })
})

for (const initialStatus of ['changes_requested', 'pending', 'published', 'rescheduled']) {
  test(`PATCH /events/:slug envía un evento ${initialStatus} a revisión`, async () => {
    let calls = 0
    await withApi(async (sql, values) => {
      calls += 1
      if (calls === 1) {
        assert.match(sql, /SELECT \* FROM events/)
        assert.deepEqual(values, ['evento-prueba', organizer.email])
        return { rows: [{ ...event, status: initialStatus }] }
      }
      assert.match(sql, /UPDATE events/)
      assert.match(sql, /status = 'pending'/)
      assert.match(sql, /WHERE slug = \$13 AND organizer_email = \$14 AND status = \$15/)
      assert.equal(values[0], event.title)
      assert.deepEqual(values.slice(-3), ['evento-prueba', organizer.email, initialStatus])
      return { rows: [{ ...event, status: 'pending' }] }
    }, async (url) => {
      const result = await request(url, '/events/evento-prueba', { method: 'PATCH', body: event, headers: auth() })
      assert.equal(result.status, 200)
      assert.equal(result.body.status, 'pending')
      assert.equal(calls, 2)
    })
  })
}

test('PATCH /events/:slug valida rol, campos, estado previo y existencia', async () => {
  await withApi(async () => assert.fail('El rol inválido no debe consultar la base'), async (url) => {
    const result = await request(url, '/events/evento-prueba', { method: 'PATCH', body: event, headers: auth(admin) })
    assert.equal(result.status, 403)
  })

  await withApi(async () => assert.fail('Campos inválidos no deben consultar la base'), async (url) => {
    const result = await request(url, '/events/evento-prueba', { method: 'PATCH', body: {}, headers: auth() })
    assert.equal(result.status, 400)
  })

  await withApi(async () => ({ rows: [] }), async (url) => {
    const missing = await request(url, '/events/no-existe', { method: 'PATCH', body: event, headers: auth() })
    assert.equal(missing.status, 404)
  })

  await withApi(async () => ({ rows: [{ ...event, status: 'cancelled' }] }), async (url) => {
    const wrongStatus = await request(url, '/events/evento-prueba', { method: 'PATCH', body: event, headers: auth() })
    assert.equal(wrongStatus.status, 400)
    assert.equal(wrongStatus.body.message, 'El estado actual del evento no permite modificarlo')
  })
})

test('PATCH /events/:slug/status modifica el estado y valida el estado solicitado', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /UPDATE events/)
    assert.equal(values[0], 'published')
    assert.equal(values[4], 'evento-prueba')
    return { rows: [{ ...event, status: 'published' }] }
  }, async (url) => {
    const result = await request(url, '/events/evento-prueba/status', { method: 'PATCH', body: { status: 'published' }, headers: auth(admin) })
    assert.equal(result.status, 200)
    assert.equal(result.body.status, 'published')
  })

  await withApi(async () => assert.fail('Un estado no válido no debe consultar la base'), async (url) => {
    const result = await request(url, '/events/evento-prueba/status', { method: 'PATCH', body: { status: 'invalid' }, headers: auth(admin) })
    assert.equal(result.status, 400)
    assert.equal(result.body.message, 'Estado inválido')
    const forbiddenStatus = await request(url, '/events/evento-prueba/status', { method: 'PATCH', body: { status: 'published' }, headers: auth(organizer) })
    assert.equal(forbiddenStatus.status, 400)
    const unauthorized = await request(url, '/events/evento-prueba/status', { method: 'PATCH', body: { status: 'published' } })
    assert.equal(unauthorized.status, 401)
  })

  await withApi(async () => ({ rows: [] }), async (url) => {
    const result = await request(url, '/events/no-existe/status', { method: 'PATCH', body: { status: 'published' }, headers: auth(admin) })
    assert.equal(result.status, 404)
  })
})

test('DELETE /events/:slug elimina propuesta propia y permite baja logica admin con motivo', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /^DELETE FROM events/)
    assert.deepEqual(values, ['evento-prueba', organizer.email])
    return { rows: [{ slug: event.slug }] }
  }, async (url) => {
    const result = await request(url, '/events/evento-prueba', { method: 'DELETE', headers: auth() })
    assert.equal(result.status, 204)
    assert.equal(result.body, null)
  })

  await withApi(async () => ({ rows: [] }), async (url) => {
    const missing = await request(url, '/events/no-existe', { method: 'DELETE', headers: auth() })
    assert.equal(missing.status, 404)
  })

  await withApi(async (sql, values) => {
    assert.match(sql, /SET status = 'deleted'/)
    assert.deepEqual(values, ['Cancelado', 'evento-prueba'])
    return { rows: [{ ...event, status: 'deleted' }] }
  }, async (url) => {
    const result = await request(url, '/events/evento-prueba', { method: 'DELETE', body: { reason: 'Cancelado' }, headers: auth(admin) })
    assert.equal(result.status, 200)
    assert.equal(result.body.status, 'deleted')
  })

  await withApi(async () => assert.fail('La falta de motivo no debe consultar la base'), async (url) => {
    const result = await request(url, '/events/evento-prueba', { method: 'DELETE', body: {}, headers: auth(admin) })
    assert.equal(result.status, 400)
  })
})
