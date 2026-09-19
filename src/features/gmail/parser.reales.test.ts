/**
 * El parser contra notificaciones REALES de Bancolombia.
 *
 * Separado de parser.test.ts a propósito: aquel cubre los formatos que estaban
 * documentados, éste cubre los que el banco manda de verdad. Los dos juegos son
 * distintos —verbos en vez de sustantivos, y dos convenciones numéricas— y fue
 * este archivo el que destapó que "$5,600.00" se guardaba como $5,60.
 *
 * Correr con:  node --import tsx --test src/features/gmail/parser.reales.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseBancolombiaEmail } from './parser'
import { CASOS_REALES, MONTOS_REALES } from './__fixtures__/reales'

for (const caso of CASOS_REALES) {
  test(`correo real: ${caso.nombre}`, () => {
    const resultado = parseBancolombiaEmail(caso.email)

    if (caso.esperado === null) {
      assert.equal(resultado, null)
      return
    }

    assert.notEqual(resultado, null, `no reconoció un correo real. ${caso.porQue}`)
    if (resultado === null) return

    assert.equal(resultado.movimiento, caso.esperado.movimiento)
    assert.equal(resultado.kind, caso.esperado.kind)
    assert.equal(resultado.merchant, caso.esperado.merchant)
    assert.equal(
      resultado.amount_cents,
      caso.esperado.amount_cents,
      `monto mal convertido. ${caso.porQue}`,
    )
    assert.equal(resultado.occurred_at.slice(0, 10), caso.esperado.occurredAtEmpiezaCon)
    assert.equal(resultado.source_ref, caso.email.id)
  })
}

test('el signo de los correos reales: uno es ingreso y dos son gastos', () => {
  const kinds = CASOS_REALES.map((c) => parseBancolombiaEmail(c.email)?.kind)
  assert.deepEqual(kinds, ['expense', 'expense', 'income'])
})

// ---------------------------------------------------------------------------
// Regresión del bug de mil veces, aislado del resto del parseo
// ---------------------------------------------------------------------------

for (const { crudo, centavos, nota } of MONTOS_REALES) {
  test(`monto "${crudo}" son ${centavos} centavos (${nota})`, () => {
    const resultado = parseBancolombiaEmail({
      id: `monto-${crudo}`,
      subject: 'Bancolombia',
      from: 'alertasynotificaciones@notificacionesbancolombia.com',
      receivedAt: '2026-09-19T12:00:00.000-05:00',
      body: `Bancolombia: Compraste ${crudo} en COMERCIO DE PRUEBA`,
    })

    assert.equal(resultado?.amount_cents, centavos)
    // El fallo clásico: tomar la convención anglosajona por colombiana y
    // guardar mil veces menos, sin que nada lance ni se vea raro.
    assert.notEqual(resultado?.amount_cents, Math.round(centavos / 1000))
  })
}
