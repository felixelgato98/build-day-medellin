/**
 * Tests del parser de Bancolombia.
 *
 * Escritos contra CONTRACT.md y SIN mirar parser.ts, a propósito: los tests que
 * escribe el mismo autor del código sólo comprueban lo que el autor ya pensó.
 *
 * Correr con:  node --import tsx --test src/features/gmail/parser.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseBancolombiaEmail, detectarMovimiento } from './parser'
import { casosBancolombia } from './__fixtures__/bancolombia'
import type { RawEmail } from './types'

/** Correo mínimo válido para armar casos hostiles sin repetir los cinco campos. */
function correo(parcial: Partial<RawEmail> & Pick<RawEmail, 'id'>): RawEmail {
  return {
    subject: 'Bancolombia',
    from: 'Bancolombia <alertasynotificaciones@bancolombia.com.co>',
    receivedAt: '2026-09-19T12:00:00.000Z',
    body: '',
    ...parcial,
  }
}

// ---------------------------------------------------------------------------
// Tabla de formatos, montos, fechas y no-transacciones — un test por fixture
// ---------------------------------------------------------------------------

for (const caso of casosBancolombia) {
  test(`parseBancolombiaEmail: ${caso.nombre}`, () => {
    const resultado = parseBancolombiaEmail(caso.email)

    if (caso.esperado === null) {
      assert.equal(
        resultado,
        null,
        'un correo que ningún reconocedor entiende debe devolver null',
      )
      return
    }

    assert.notEqual(resultado, null, 'este formato sí está en la tabla del contrato')
    if (resultado === null) return // estrecha el tipo para TypeScript

    assert.equal(resultado.kind, caso.esperado.kind)
    assert.equal(resultado.movimiento, caso.esperado.movimiento)
    assert.equal(resultado.merchant, caso.esperado.merchant)

    // El monto se compara en centavos exactos: si acá pasara 45 en vez de
    // 4500000 nada se rompería a la vista, sólo el balance por mil veces.
    assert.equal(
      resultado.amount_cents,
      caso.esperado.amount_cents,
      `el monto debe quedar en centavos (${caso.esperado.amount_cents})`,
    )
    assert.equal(Number.isInteger(resultado.amount_cents), true)

    assert.equal(resultado.source_ref, caso.esperado.source_ref)

    assert.equal(typeof resultado.description, 'string')
    assert.notEqual(resultado.description.trim(), '')

    // La zona horaria no la fija el contrato; el día calendario sí.
    assert.equal(
      Number.isNaN(Date.parse(resultado.occurred_at)),
      false,
      'occurred_at debe ser ISO 8601 parseable',
    )
    assert.equal(resultado.occurred_at.slice(0, 10), caso.occurredAtDia)

    if (caso.occurredAtEsReceivedAt === true) {
      assert.equal(
        resultado.occurred_at,
        caso.email.receivedAt,
        'sin fecha en el cuerpo, occurred_at cae a receivedAt sin reinterpretarlo',
      )
    }
  })
}

// ---------------------------------------------------------------------------
// source_ref: es lo único que impide duplicar gastos al reprocesar el buzón
// ---------------------------------------------------------------------------

test('source_ref siempre es igual al id del correo', () => {
  for (const caso of casosBancolombia) {
    const resultado = parseBancolombiaEmail(caso.email)
    if (resultado === null) continue
    assert.equal(
      resultado.source_ref,
      caso.email.id,
      `source_ref != id en el caso "${caso.nombre}"`,
    )
  }
})

test('source_ref usa el id recibido, no el asunto ni el remitente', () => {
  const resultado = parseBancolombiaEmail(
    correo({ id: 'pegado:a1b2c3', body: 'Compra por $45.000 en EXITO ENVIGADO' }),
  )
  assert.notEqual(resultado, null)
  assert.equal(resultado?.source_ref, 'pegado:a1b2c3')
})

// ---------------------------------------------------------------------------
// El orden de evaluación es correctitud, no estética
// ---------------------------------------------------------------------------

test('"Recepción de transferencia" NO se clasifica como gasto', () => {
  const resultado = parseBancolombiaEmail(
    correo({
      id: 'trampa-1',
      subject: 'Recepción de transferencia',
      body: 'Recepción de transferencia por $500.000 de CARLOS RESTREPO el 16/09/2026 11:05',
    }),
  )

  assert.notEqual(resultado, null)
  assert.equal(resultado?.kind, 'income')
  assert.equal(resultado?.movimiento, 'transferencia_entrante')
  // Si el formato 5 gana sobre el 1, el balance queda mal por el doble del monto.
  assert.notEqual(resultado?.movimiento, 'transferencia_saliente')
  assert.equal(resultado?.amount_cents, 50000000)
  assert.equal(resultado?.merchant, 'CARLOS RESTREPO')
})

test('la transferencia saliente sigue siendo gasto (el orden no invierte el otro caso)', () => {
  const resultado = parseBancolombiaEmail(
    correo({ id: 'trampa-2', body: 'Transferencia por $150.000 a MARIA GOMEZ' }),
  )
  assert.equal(resultado?.kind, 'expense')
  assert.equal(resultado?.movimiento, 'transferencia_saliente')
})

// ---------------------------------------------------------------------------
// detectarMovimiento: qué reconocedor ganó
// ---------------------------------------------------------------------------

const textosPorMovimiento = [
  ['Recepción de transferencia por $500.000 de CARLOS RESTREPO', 'transferencia_entrante'],
  ['Pago recibido por $80.000 de ANA LOPEZ', 'pago_recibido'],
  ['Compra por $45.000 en EXITO ENVIGADO', 'compra'],
  ['Retiro por $200.000 en CAJERO AUTOMATICO CC SANTAFE', 'retiro'],
  ['Transferencia por $150.000 a MARIA GOMEZ', 'transferencia_saliente'],
] as const

for (const [texto, esperado] of textosPorMovimiento) {
  test(`detectarMovimiento reconoce "${esperado}"`, () => {
    assert.equal(detectarMovimiento(texto), esperado)
  })
}

test('detectarMovimiento devuelve null para texto que no es un movimiento', () => {
  assert.equal(detectarMovimiento(''), null)
  assert.equal(
    detectarMovimiento('Le informamos que la clave de su Sucursal Virtual fue actualizada.'),
    null,
  )
  assert.equal(
    detectarMovimiento('Tenemos un cupo preaprobado de hasta $10.000.000 para vos.'),
    null,
  )
})

test('detectarMovimiento coincide con el movimiento de cada fixture', () => {
  for (const caso of casosBancolombia) {
    assert.equal(
      detectarMovimiento(caso.email.body),
      caso.esperado === null ? null : caso.esperado.movimiento,
      `detectarMovimiento falló en el caso "${caso.nombre}"`,
    )
  }
})

// ---------------------------------------------------------------------------
// Robustez: el parser NUNCA lanza. Una excepción tumba el sync de 80 correos.
// ---------------------------------------------------------------------------

const correosHostiles: RawEmail[] = [
  correo({ id: 'h1', body: '' }),
  correo({ id: 'h2', body: '$' }),
  correo({ id: 'h3', body: 'Compra por $ en TIENDA SIN MONTO' }),
  correo({ id: 'h4', body: 'Compra por en' }),
  correo({ id: 'h5', body: 'Compra por $45.000 en' }),
  correo({ id: 'h6', body: '(*+[]{}|\\^$?.) Compra por $$$ en ???' }),
  correo({ id: 'h7', body: 'Compra por $45.000 en EXITO el 99/99/9999 99:99' }),
  correo({ id: 'h8', body: 'x'.repeat(50_000) }),
  correo({ id: 'h9', body: 'Compra por $45.000 en 🏪 EXITO ENVIGADO', subject: '🏦' }),
  correo({ id: 'h10', body: 'Compra por $45.000 en EXITO', receivedAt: 'no-es-una-fecha' }),
]

for (const email of correosHostiles) {
  test(`parseBancolombiaEmail no lanza con el correo hostil "${email.id}"`, () => {
    const resultado = parseBancolombiaEmail(email)
    if (resultado !== null) {
      assert.equal(typeof resultado.amount_cents, 'number')
      assert.equal(Number.isFinite(resultado.amount_cents), true)
      assert.equal(resultado.source_ref, email.id)
    }
  })
}

test('un monto ilegible no produce NaN ni 0 silencioso: devuelve null', () => {
  const resultado = parseBancolombiaEmail(
    correo({ id: 'sin-monto', body: 'Compra por $ en TIENDA SIN MONTO' }),
  )
  assert.equal(resultado, null)
})

// ---------------------------------------------------------------------------
// Regresión del bug de mil veces: parseFloat sobre un monto colombiano
// ---------------------------------------------------------------------------

test('el monto no se parsea con parseFloat: "$45.000" son 4500000, no 45', () => {
  const resultado = parseBancolombiaEmail(
    correo({ id: 'cop-1', body: 'Compra por $45.000 en EXITO ENVIGADO' }),
  )
  assert.equal(resultado?.amount_cents, 4500000)
  assert.notEqual(resultado?.amount_cents, 45)      // parseFloat('45.000')
  assert.notEqual(resultado?.amount_cents, 4500)    // parseFloat('45.000') * 100
  assert.notEqual(resultado?.amount_cents, 45000)   // pesos en vez de centavos
})

test('el punto es separador de miles, no decimal, aunque haya varios', () => {
  const resultado = parseBancolombiaEmail(
    correo({ id: 'cop-2', body: 'Transferencia por COP 1.250.000 a INMOBILIARIA EL POBLADO' }),
  )
  assert.equal(resultado?.amount_cents, 125000000)
  assert.notEqual(resultado?.amount_cents, 125)     // parseFloat('1.250') * 100
})

test('la coma sí es el decimal: "$45.000,50" son 4500050 centavos', () => {
  const resultado = parseBancolombiaEmail(
    correo({ id: 'cop-3', body: 'Compra por $45.000,50 en OLIMPICA LA 65' }),
  )
  assert.equal(resultado?.amount_cents, 4500050)
})
