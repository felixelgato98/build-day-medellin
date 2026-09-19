/**
 * Correos de Bancolombia anonimizados + lo que el parser debe devolver.
 *
 * Escritos contra CONTRACT.md, sin mirar parser.ts: si el fixture se escribe
 * leyendo la implementación sólo confirma lo que el autor ya pensó, y los
 * formatos que nadie contempló siguen rotos en producción.
 */
import type { ParsedTransaction, RawEmail } from '../types'

/**
 * `description` y `occurred_at` quedan fuera de la comparación exacta.
 *
 * El contrato no fija el texto de la descripción ni la zona horaria con la que
 * se serializa la fecha ("19/09/2026 14:32" es válido como -05:00 o como Z).
 * Un test que exija más que el contrato rompe implementaciones correctas.
 */
export type TransaccionEsperada = Omit<ParsedTransaction, 'description' | 'occurred_at'>

interface CasoParseado {
  nombre: string
  email: RawEmail
  esperado: TransaccionEsperada
  /** Día calendario (YYYY-MM-DD) que debe tener `occurred_at`. */
  occurredAtDia: string
  /** El correo no trae fecha propia: `occurred_at` debe ser `receivedAt` tal cual. */
  occurredAtEsReceivedAt?: boolean
}

interface CasoIgnorado {
  nombre: string
  email: RawEmail
  esperado: null
}

export type CasoBancolombia = CasoParseado | CasoIgnorado

const REMITENTE = 'Bancolombia <alertasynotificaciones@bancolombia.com.co>'

export const casosBancolombia: CasoBancolombia[] = [
  // ---------------------------------------------------------------------
  // Los cinco formatos de la tabla del contrato
  // ---------------------------------------------------------------------
  {
    nombre: 'formato 3: compra con comercio y fecha en el cuerpo',
    email: {
      id: '18f0a1b2c3d4e5f6',
      subject: 'Bancolombia: Compra aprobada',
      from: REMITENTE,
      receivedAt: '2026-09-19T19:33:10.000Z',
      body: [
        'Bancolombia le informa:',
        'Compra por $45.000 en EXITO ENVIGADO el 19/09/2026 14:32',
        'Tarjeta terminada en 1234.',
      ].join('\n'),
    },
    esperado: {
      kind: 'expense',
      movimiento: 'compra',
      amount_cents: 4500000,
      merchant: 'EXITO ENVIGADO',
      source_ref: '18f0a1b2c3d4e5f6',
    },
    occurredAtDia: '2026-09-19',
  },
  {
    nombre: 'formato 4: retiro en cajero, el comercio lleva varias palabras',
    email: {
      id: '18f0a1b2c3d4e5f7',
      subject: 'Bancolombia: Retiro exitoso',
      from: REMITENTE,
      receivedAt: '2026-09-18T14:13:00.000Z',
      body: 'Retiro por $200.000 en CAJERO AUTOMATICO CC SANTAFE el 18/09/2026 09:12',
    },
    esperado: {
      kind: 'expense',
      movimiento: 'retiro',
      amount_cents: 20000000,
      merchant: 'CAJERO AUTOMATICO CC SANTAFE',
      source_ref: '18f0a1b2c3d4e5f7',
    },
    occurredAtDia: '2026-09-18',
  },
  {
    nombre: 'formato 5: transferencia saliente a una persona',
    email: {
      id: '18f0a1b2c3d4e5f8',
      subject: 'Bancolombia: Transferencia realizada',
      from: REMITENTE,
      receivedAt: '2026-09-17T21:41:00.000Z',
      body: 'Transferencia por $150.000 a MARIA GOMEZ el 17/09/2026 16:40',
    },
    esperado: {
      kind: 'expense',
      movimiento: 'transferencia_saliente',
      amount_cents: 15000000,
      merchant: 'MARIA GOMEZ',
      source_ref: '18f0a1b2c3d4e5f8',
    },
    occurredAtDia: '2026-09-17',
  },
  {
    nombre: 'formato 1 (el caso trampa): recepción de transferencia es INGRESO, no gasto',
    email: {
      id: '18f0a1b2c3d4e5f9',
      subject: 'Bancolombia: Recepción de transferencia',
      from: REMITENTE,
      receivedAt: '2026-09-16T16:06:00.000Z',
      body: 'Recepción de transferencia por $500.000 de CARLOS RESTREPO el 16/09/2026 11:05',
    },
    esperado: {
      kind: 'income',
      movimiento: 'transferencia_entrante',
      amount_cents: 50000000,
      merchant: 'CARLOS RESTREPO',
      source_ref: '18f0a1b2c3d4e5f9',
    },
    occurredAtDia: '2026-09-16',
  },
  {
    nombre: 'formato 2: pago recibido de un tercero',
    email: {
      id: '18f0a1b2c3d4e5fa',
      subject: 'Bancolombia: Pago recibido',
      from: REMITENTE,
      receivedAt: '2026-09-15T23:21:00.000Z',
      body: 'Pago recibido por $80.000 de ANA LOPEZ el 15/09/2026 18:20',
    },
    esperado: {
      kind: 'income',
      movimiento: 'pago_recibido',
      amount_cents: 8000000,
      merchant: 'ANA LOPEZ',
      source_ref: '18f0a1b2c3d4e5fa',
    },
    occurredAtDia: '2026-09-15',
  },

  // ---------------------------------------------------------------------
  // Montos en formato colombiano: el punto es separador de MILES
  // ---------------------------------------------------------------------
  {
    nombre: 'monto con centavos: "$45.000,50" son 4.500.050 centavos',
    email: {
      id: '18f0a1b2c3d4e5fb',
      subject: 'Bancolombia: Compra aprobada',
      from: REMITENTE,
      receivedAt: '2026-09-14T17:01:00.000Z',
      body: 'Compra por $45.000,50 en OLIMPICA LA 65 el 14/09/2026 12:00',
    },
    esperado: {
      kind: 'expense',
      movimiento: 'compra',
      amount_cents: 4500050,
      merchant: 'OLIMPICA LA 65',
      source_ref: '18f0a1b2c3d4e5fb',
    },
    occurredAtDia: '2026-09-14',
  },
  {
    nombre: 'monto con espacio después del signo: "$ 45.000"',
    email: {
      id: '18f0a1b2c3d4e5fc',
      subject: 'Bancolombia: Compra aprobada',
      from: REMITENTE,
      receivedAt: '2026-09-14T00:31:00.000Z',
      body: 'Compra por $ 45.000 en ARA BELEN el 13/09/2026 19:30',
    },
    esperado: {
      kind: 'expense',
      movimiento: 'compra',
      amount_cents: 4500000,
      merchant: 'ARA BELEN',
      source_ref: '18f0a1b2c3d4e5fc',
    },
    occurredAtDia: '2026-09-13',
  },
  {
    nombre: 'monto con prefijo "COP" en vez de "$" y dos separadores de miles',
    email: {
      id: '18f0a1b2c3d4e5fd',
      subject: 'Bancolombia: Transferencia realizada',
      from: REMITENTE,
      receivedAt: '2026-09-12T15:01:00.000Z',
      body: 'Transferencia por COP 1.250.000 a INMOBILIARIA EL POBLADO el 12/09/2026 10:00',
    },
    esperado: {
      kind: 'expense',
      movimiento: 'transferencia_saliente',
      amount_cents: 125000000,
      merchant: 'INMOBILIARIA EL POBLADO',
      source_ref: '18f0a1b2c3d4e5fd',
    },
    occurredAtDia: '2026-09-12',
  },
  {
    nombre: 'monto grande: "$2.350.000" son 235.000.000 centavos, no 2.350',
    email: {
      id: '18f0a1b2c3d4e5fe',
      subject: 'Bancolombia: Recepción de transferencia',
      from: REMITENTE,
      receivedAt: '2026-09-11T13:01:00.000Z',
      body: 'Recepción de transferencia por $2.350.000 de NOMINA EMPRESA SAS el 11/09/2026 08:00',
    },
    esperado: {
      kind: 'income',
      movimiento: 'transferencia_entrante',
      amount_cents: 235000000,
      merchant: 'NOMINA EMPRESA SAS',
      source_ref: '18f0a1b2c3d4e5fe',
    },
    occurredAtDia: '2026-09-11',
  },
  {
    nombre: 'monto chico con separador: "$1.000" son 100.000 centavos, no 100',
    email: {
      id: '18f0a1b2c3d4e5ff',
      subject: 'Bancolombia: Compra aprobada',
      from: REMITENTE,
      receivedAt: '2026-09-10T12:46:00.000Z',
      body: 'Compra por $1.000 en PARQUEADERO CENTRO el 10/09/2026 07:45',
    },
    esperado: {
      kind: 'expense',
      movimiento: 'compra',
      amount_cents: 100000,
      merchant: 'PARQUEADERO CENTRO',
      source_ref: '18f0a1b2c3d4e5ff',
    },
    occurredAtDia: '2026-09-10',
  },

  // ---------------------------------------------------------------------
  // Fecha: la del cuerpo manda; si no hay, cae a receivedAt
  // ---------------------------------------------------------------------
  {
    nombre: 'sin fecha en el cuerpo: occurred_at cae a receivedAt tal cual',
    email: {
      id: '18f0a1b2c3d4e600',
      subject: 'Bancolombia: Compra aprobada',
      from: REMITENTE,
      receivedAt: '2026-09-09T13:05:00.000Z',
      body: 'Compra por $12.900 en JUAN VALDEZ CAFE',
    },
    esperado: {
      kind: 'expense',
      movimiento: 'compra',
      amount_cents: 1290000,
      merchant: 'JUAN VALDEZ CAFE',
      source_ref: '18f0a1b2c3d4e600',
    },
    occurredAtDia: '2026-09-09',
    occurredAtEsReceivedAt: true,
  },
  {
    nombre: 'fecha día/mes/año: 06/09/2026 es 6 de septiembre, no 9 de junio',
    email: {
      id: '18f0a1b2c3d4e601',
      subject: 'Bancolombia: Compra aprobada',
      from: REMITENTE,
      // Llegó días después de ocurrir: si el parser ignora la fecha del cuerpo,
      // el gasto se va al mes equivocado y el Dashboard cierra mal el mes.
      receivedAt: '2026-09-20T10:00:00.000Z',
      body: 'Compra por $76.500 en CARULLA LAURELES el 06/09/2026 15:44',
    },
    esperado: {
      kind: 'expense',
      movimiento: 'compra',
      amount_cents: 7650000,
      merchant: 'CARULLA LAURELES',
      source_ref: '18f0a1b2c3d4e601',
    },
    occurredAtDia: '2026-09-06',
  },

  // ---------------------------------------------------------------------
  // Cuerpos sucios: así llegan de verdad después de convertir el HTML
  // ---------------------------------------------------------------------
  {
    nombre: 'HTML mal convertido: &nbsp; y saltos de línea en medio de la frase',
    email: {
      id: '18f0a1b2c3d4e602',
      subject: 'Bancolombia: Compra aprobada',
      from: REMITENTE,
      receivedAt: '2026-09-18T15:06:00.000Z',
      body: [
        'Bancolombia&nbsp;le informa:',
        '',
        '   ',
        'Compra por $89.900',
        'en FALABELLA POBLADO',
        'el 18/09/2026 10:05',
        '',
        '&nbsp;',
        'Este es un mensaje automático, no responda este correo.',
      ].join('\n'),
    },
    esperado: {
      kind: 'expense',
      movimiento: 'compra',
      amount_cents: 8990000,
      merchant: 'FALABELLA POBLADO',
      source_ref: '18f0a1b2c3d4e602',
    },
    occurredAtDia: '2026-09-18',
  },

  // ---------------------------------------------------------------------
  // Lo que NO es una transacción: devolver null, nunca lanzar
  // ---------------------------------------------------------------------
  {
    nombre: 'publicidad de Bancolombia: menciona plata y "compras" pero no es un movimiento',
    email: {
      id: '18f0a1b2c3d4e603',
      subject: '¡Estrena tu Tarjeta de Crédito Bancolombia!',
      from: 'Bancolombia <comunicaciones@bancolombia.com.co>',
      receivedAt: '2026-09-08T11:00:00.000Z',
      body: [
        'Tenemos un cupo preaprobado de hasta $10.000.000 para vos.',
        'Sin cuota de manejo el primer año y beneficios en compras en el exterior.',
        'Solicitala en la Sucursal Virtual.',
      ].join('\n'),
    },
    esperado: null,
  },
  {
    nombre: 'aviso de seguridad sin monto: formato desconocido devuelve null',
    email: {
      id: '18f0a1b2c3d4e604',
      subject: 'Bancolombia: Actualización de clave',
      from: REMITENTE,
      receivedAt: '2026-09-07T08:30:00.000Z',
      body: 'Le informamos que la clave de su Sucursal Virtual fue actualizada con éxito.',
    },
    esperado: null,
  },
  {
    nombre: 'cuerpo vacío: null sin explotar',
    email: {
      id: '18f0a1b2c3d4e605',
      subject: '',
      from: REMITENTE,
      receivedAt: '2026-09-06T08:30:00.000Z',
      body: '',
    },
    esperado: null,
  },
]
