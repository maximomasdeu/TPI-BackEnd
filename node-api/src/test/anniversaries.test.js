import assert from 'node:assert/strict'
import { test } from 'node:test'
import { admin, auth, organizer, request, withApi } from './helpers.js'

// Casos de API para lectura, creación, moderación y eliminación de efemérides.
const anniversary = {
  id: 7,
  title: 'Aniversario de prueba',
  description: 'Descripcion',
  day: 12,
  month: 5,
  organization: 'Club',
  status: 'pending',
}

test('GET /anniversaries lista efemerides visibles y admite filtro de estado', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /FROM anniversaries WHERE status = ANY\(\$1::text\[\]\) AND status = \$2/)
    assert.deepEqual(values, [['published'], 'published'])
    return { rows: [{ ...anniversary, status: 'published' }] }
  }, async (url) => {
    const result = await request(url, '/anniversaries?status=published')
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, [{ ...anniversary, status: 'published' }])
  })
})

test('GET /anniversaries incluye efemérides propias rechazadas y dadas de baja', async () => {
  const moderatedAnniversaries = ['rejected', 'deleted'].map((status, index) => ({
    ...anniversary,
    id: anniversary.id + index,
    organizer_email: organizer.email,
    status,
    review_note: 'Motivo de moderación',
  }))

  await withApi(async (sql, values) => {
    assert.match(sql, /WHERE \(status = ANY\(\$1::text\[\]\) OR organizer_email = \$2\) ORDER BY/)
    assert.deepEqual(values, [['published'], organizer.email])
    return { rows: moderatedAnniversaries }
  }, async (url) => {
    const result = await request(url, '/anniversaries', { headers: auth() })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, moderatedAnniversaries)
  })
})

test('GET /anniversaries/:id obtiene por id y responde 404 si no existe', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /WHERE id = \$1 AND \(status = ANY/)
    assert.deepEqual(values, ['7', ['published'], organizer.email])
    return { rows: [anniversary] }
  }, async (url) => {
    const result = await request(url, '/anniversaries/7', { headers: auth() })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, anniversary)
  })

  await withApi(async () => ({ rows: [] }), async (url) => {
    const result = await request(url, '/anniversaries/404')
    assert.equal(result.status, 404)
    assert.equal(result.body.message, 'Efeméride no encontrada')
  })
})

test('POST /anniversaries crea con autenticacion y valida los campos y la fecha', async () => {
  const body = { title: 'Aniversario nuevo', description: 'Descripcion', day: 12, month: 5, organization: 'Club' }
  await withApi(async (sql, values) => {
    assert.match(sql, /INSERT INTO anniversaries/)
    assert.equal(values[0], body.title)
    assert.equal(values[6], organizer.email)
    return { rows: [{ ...anniversary, ...body }] }
  }, async (url) => {
    const result = await request(url, '/anniversaries', { method: 'POST', body, headers: auth() })
    assert.equal(result.status, 201)
    assert.equal(result.body.title, body.title)
  })

  await withApi(async () => assert.fail('No debe consultar la base para un cuerpo inválido'), async (url) => {
    const missing = await request(url, '/anniversaries', { method: 'POST', body: { title: 'Falta el resto' }, headers: auth() })
    assert.equal(missing.status, 400)
    assert.match(missing.body.message, /Falta el campo obligatorio/)
    const invalidDate = await request(url, '/anniversaries', { method: 'POST', body: { title: 'X', description: 'Y', day: 32, month: 5, organization: 'Club' }, headers: auth() })
    assert.equal(invalidDate.status, 400)
    assert.equal(invalidDate.body.message, 'El día o el mes no son válidos')
    const duplicateImages = await request(url, '/anniversaries', { method: 'POST', body: { title: 'X', description: 'Y', day: 12, month: 5, organization: 'Club', image: 'https://example.com/a.jpg', image_source: { type: 'url', url: 'https://example.com/b.jpg' } }, headers: auth() })
    assert.equal(duplicateImages.status, 400)
    const unauthorized = await request(url, '/anniversaries', { method: 'POST', body: {} })
    assert.equal(unauthorized.status, 401)
  }, { quietErrors: true })
})

test('PATCH /anniversaries/:id/status modifica estado solo con rol admin y valida estado e id', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /UPDATE anniversaries/)
    assert.deepEqual(values, ['published', 'Revisada', '7'])
    return { rows: [{ ...anniversary, status: 'published' }] }
  }, async (url) => {
    const result = await request(url, '/anniversaries/7/status', { method: 'PATCH', body: { status: 'published', review_note: 'Revisada' }, headers: auth(admin) })
    assert.equal(result.status, 200)
    assert.equal(result.body.status, 'published')
  })

  await withApi(async () => assert.fail('Estado inválido no debe consultar la base'), async (url) => {
    const invalid = await request(url, '/anniversaries/7/status', { method: 'PATCH', body: { status: 'deleted' }, headers: auth(admin) })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.body.message, 'Estado inválido')
    const missing = await request(url, '/anniversaries/7/status', { method: 'PATCH', body: { status: 'published' }, headers: auth(organizer) })
    assert.equal(missing.status, 400)
  })

  await withApi(async () => ({ rows: [] }), async (url) => {
    const result = await request(url, '/anniversaries/404/status', { method: 'PATCH', body: { status: 'published' }, headers: auth(admin) })
    assert.equal(result.status, 404)
  })
})

test('DELETE /anniversaries/:id elimina propuesta propia y permite baja logica admin con motivo', async () => {
  await withApi(async (sql, values) => {
    assert.match(sql, /^DELETE FROM anniversaries/)
    assert.deepEqual(values, ['7', organizer.email])
    return { rows: [{ id: 7 }] }
  }, async (url) => {
    const result = await request(url, '/anniversaries/7', { method: 'DELETE', headers: auth() })
    assert.equal(result.status, 204)
    assert.equal(result.body, null)
  })

  await withApi(async () => ({ rows: [] }), async (url) => {
    const result = await request(url, '/anniversaries/404', { method: 'DELETE', headers: auth() })
    assert.equal(result.status, 404)
  })

  await withApi(async (sql, values) => {
    assert.match(sql, /SET status = 'deleted'/)
    assert.deepEqual(values, ['Duplicada', '7'])
    return { rows: [{ ...anniversary, status: 'deleted' }] }
  }, async (url) => {
    const result = await request(url, '/anniversaries/7', { method: 'DELETE', body: { reason: 'Duplicada' }, headers: auth(admin) })
    assert.equal(result.status, 200)
    assert.equal(result.body.status, 'deleted')
  })

  await withApi(async () => assert.fail('Falta del motivo no debe consultar la base'), async (url) => {
    const result = await request(url, '/anniversaries/7', { method: 'DELETE', body: {}, headers: auth(admin) })
    assert.equal(result.status, 400)
    assert.equal(result.body.message, 'El motivo de eliminación es obligatorio')
  })
})
