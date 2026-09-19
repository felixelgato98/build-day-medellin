import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pesosToCents } from './logic'

test('pesosToCents convierte pesos enteros a centavos', () => {
  assert.equal(pesosToCents(45000), 4500000)
})

test('pesosToCents redondea decimales a centavos enteros', () => {
  assert.equal(pesosToCents(1234.567), 123457)
})

test('pesosToCents rechaza cero, negativos y no finitos', () => {
  assert.equal(pesosToCents(0), null)
  assert.equal(pesosToCents(-5), null)
  assert.equal(pesosToCents(Number.NaN), null)
  assert.equal(pesosToCents(Number.POSITIVE_INFINITY), null)
})

import { resolveCategory } from './logic'

const CATS = [
  { id: 'c1', name: 'Mercado', kind: 'expense' as const },
  { id: 'c2', name: 'Restaurantes', kind: 'expense' as const },
  { id: 'c3', name: 'Educación', kind: 'expense' as const },
  { id: 'c4', name: 'Salario', kind: 'income' as const },
]

test('resolveCategory encuentra por nombre exacto', () => {
  assert.deepEqual(resolveCategory(CATS, 'Mercado'), { ok: true, category: CATS[0] })
})

test('resolveCategory ignora mayúsculas, tildes y espacios', () => {
  assert.deepEqual(resolveCategory(CATS, '  educacion '), { ok: true, category: CATS[2] })
})

test('resolveCategory filtra por tipo cuando se pide', () => {
  const r = resolveCategory(CATS, 'Salario', 'expense')
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /Salario/)
})

test('resolveCategory lista las opciones válidas cuando no encuentra', () => {
  const r = resolveCategory(CATS, 'Comida', 'expense')
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.match(r.error, /Comida/)
    assert.match(r.error, /Mercado, Restaurantes, Educación/)
    assert.doesNotMatch(r.error, /Salario/)
  }
})

import { canDeleteFromChat, normalizeRange } from './logic'

const NOW = new Date('2026-09-19T15:00:00.000Z')

test('canDeleteFromChat permite manual reciente', () => {
  const tx = { source: 'manual' as const, created_at: '2026-09-19T10:00:00.000Z' }
  assert.deepEqual(canDeleteFromChat(tx, NOW), { ok: true })
})

test('canDeleteFromChat rechaza orígenes que no son manuales', () => {
  const tx = { source: 'gmail' as const, created_at: '2026-09-19T10:00:00.000Z' }
  const r = canDeleteFromChat(tx, NOW)
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /gmail/)
})

test('canDeleteFromChat rechaza manuales con más de 24 horas', () => {
  const tx = { source: 'manual' as const, created_at: '2026-09-18T14:59:59.000Z' }
  const r = canDeleteFromChat(tx, NOW)
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /24 horas/)
})

test('normalizeRange sin fechas devuelve el mes actual completo', () => {
  const r = normalizeRange({}, NOW)
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.from.slice(0, 10), '2026-09-01')
    assert.equal(r.to.slice(0, 10), '2026-09-30')
  }
})

test('normalizeRange extiende una fecha "hasta" sin hora al fin del día', () => {
  const r = normalizeRange({ desde: '2026-09-01', hasta: '2026-09-10' }, NOW)
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.from, '2026-09-01T00:00:00.000Z')
    assert.equal(r.to, '2026-09-10T23:59:59.999Z')
  }
})

test('normalizeRange rechaza fechas inválidas o invertidas', () => {
  assert.equal(normalizeRange({ desde: 'ayer' }, NOW).ok, false)
  const r = normalizeRange({ desde: '2026-09-10', hasta: '2026-09-01' }, NOW)
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /anterior/)
})

import { describeStreamError } from './logic'

test('describeStreamError explica el bloqueo de plan gratuito del gateway', () => {
  const err = Object.assign(new Error('Free tier users do not have access to this model.'), {
    statusCode: 403,
  })
  assert.match(describeStreamError(err), /plan gratuito|créditos/i)
})

test('describeStreamError explica fallas de autenticación', () => {
  const err = Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  assert.match(describeStreamError(err), /credenciales|AI Gateway/i)
})

test('describeStreamError nunca filtra el mensaje crudo de errores desconocidos', () => {
  const msg = describeStreamError(new Error('ECONNRESET at socket.js:120'))
  assert.doesNotMatch(msg, /ECONNRESET/)
  assert.match(msg, /intent/i)
})

test('describeStreamError tolera valores que no son Error', () => {
  assert.equal(typeof describeStreamError('boom'), 'string')
})

test('describeStreamError también lee responseBody del gateway', () => {
  const err = Object.assign(new Error('Failed to process error response'), {
    statusCode: 403,
    responseBody: '{"error":{"type":"no_providers_available","name":"RestrictedModelsError"}}',
  })
  assert.match(describeStreamError(err), /plan gratuito|créditos/i)
})
