/**
 * Notificaciones REALES de Bancolombia, con la estructura intacta y los datos
 * identificatorios cambiados (el repo es público: nombres y números de cuenta
 * reales no pueden quedar acá).
 *
 * Lo que importa de un fixture es la FORMA de la frase, no el dato. Los montos
 * se conservan tal cual porque las tres convenciones numéricas distintas que
 * usa el banco son justamente lo que estos casos existen para atrapar.
 *
 * Origen: correos del buzón de un integrante del equipo, septiembre 2026.
 */
import type { RawEmail } from '../types'

export interface CasoReal {
  nombre: string
  email: RawEmail
  /** null = ningún reconocedor debería matchear. */
  esperado: {
    movimiento: string
    kind: 'income' | 'expense'
    amount_cents: number
    merchant: string | null
    /** Prefijo ISO que debe cumplir occurred_at. */
    occurredAtEmpiezaCon: string
  } | null
  /** Por qué este caso está acá. Si se rompe, esto explica qué se perdió. */
  porQue: string
}

export const CASOS_REALES: CasoReal[] = [
  {
    nombre: 'compra con tarjeta de crédito, monto en formato colombiano con prefijo COP',
    email: {
      id: 'real-001',
      subject: 'Bancolombia: Compraste COP19.917,00 en UBER*RIDES',
      from: 'alertasynotificaciones@notificacionesbancolombia.com',
      receivedAt: '2026-09-17T20:43:00.000-05:00',
      body:
        'Bancolombia: Compraste COP19.917,00 en UBER*RIDES con tu T.Cred *1234, ' +
        'el 17/09/2026 a las 20:43. Si tienes dudas, encuentranos aqui: ' +
        '6045109095 o 018000931987. Estamos cerca.',
    },
    esperado: {
      movimiento: 'compra',
      kind: 'expense',
      amount_cents: 1991700,
      merchant: 'UBER*RIDES',
      occurredAtEmpiezaCon: '2026-09-17',
    },
    porQue:
      'El monto viene SIN signo peso y con prefijo "COP" pegado al número. ' +
      'El comercio lleva un asterisco en el nombre (UBER*RIDES), que no se ' +
      'debe confundir con la máscara de la tarjeta.',
  },
  {
    nombre: 'transferencia saliente, monto en formato ANGLO y año de dos dígitos',
    email: {
      id: 'real-002',
      subject: 'Bancolombia: Transferiste $5,600.00',
      from: 'alertasynotificaciones@notificacionesbancolombia.com',
      receivedAt: '2026-09-15T16:38:00.000-05:00',
      body:
        'Bancolombia: Transferiste $5,600.00 desde tu cuenta *0000 a la cuenta ' +
        '*1111111111 el 15/09/26 a las 16:38. ¿Dudas? Llamanos al 018000931987. ' +
        'Estamos cerca.',
    },
    esperado: {
      movimiento: 'transferencia_saliente',
      kind: 'expense',
      amount_cents: 560000,
      merchant: '*1111111111',
      occurredAtEmpiezaCon: '2026-09-15',
    },
    porQue:
      'EL CASO MÁS PELIGROSO DE TODOS. "$5,600.00" usa coma de miles y punto ' +
      'decimal: convención anglosajona, no colombiana. parseCOPToCents() por sí ' +
      'solo devuelve 560 centavos ($5,60) en vez de 560000 ($5.600) — mil veces ' +
      'menos, y sin lanzar ningún error. Además el año viene de dos dígitos ' +
      '("15/09/26"), y hay DOS cuentas en la frase: la propia y la destino.',
  },
  {
    nombre: 'transferencia entrante, monto anglo sin decimales, cuenta con doble asterisco',
    email: {
      id: 'real-003',
      subject: 'Bancolombia: Recibiste una transferencia por $20,000',
      from: 'alertasynotificaciones@notificacionesbancolombia.com',
      receivedAt: '2026-09-12T13:00:00.000-05:00',
      body:
        'Bancolombia: Recibiste una transferencia por $20,000 de PEPITA PEREZ ' +
        'en tu cuenta **0000, el 12/09/2026 a las 13:00. Si tienes dudas, ' +
        'hablemos: 018000931987. Siempre a tu lado.',
    },
    esperado: {
      movimiento: 'transferencia_entrante',
      kind: 'income',
      amount_cents: 2000000,
      merchant: 'PEPITA PEREZ',
      occurredAtEmpiezaCon: '2026-09-12',
    },
    porQue:
      'El único INGRESO de los tres: si se clasifica como gasto, el balance se ' +
      'desvía por el doble del monto. "$20,000" son veinte mil pesos, no veinte: ' +
      'coma de miles sin decimales. La cuenta viene con DOS asteriscos (**0000), ' +
      'no uno.',
  },
]

/**
 * Los tres montos crudos, aislados.
 *
 * Bancolombia mezcla dos convenciones numéricas en sus propias notificaciones,
 * así que el normalizador del módulo tiene que decidir cuál aplica en cada caso
 * antes de delegar en parseCOPToCents().
 */
export const MONTOS_REALES: Array<{ crudo: string; centavos: number; nota: string }> = [
  { crudo: 'COP19.917,00', centavos: 1991700, nota: 'colombiano: punto miles, coma decimal' },
  { crudo: '$5,600.00', centavos: 560000, nota: 'anglo: coma miles, punto decimal' },
  { crudo: '$20,000', centavos: 2000000, nota: 'anglo: coma de miles, sin decimales' },
  { crudo: '$45.000', centavos: 4500000, nota: 'colombiano: punto de miles (el del README)' },
]
