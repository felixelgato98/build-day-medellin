/**
 * Tipos del módulo Gmail / Bancolombia.
 *
 * Contrato compartido por todas las piezas del módulo. Si cambiás algo acá
 * rompés a las demás, así que leé CONTRACT.md antes de tocarlo.
 */
import type { TransactionKind } from '@/lib/types'

/**
 * Un correo, sin saber de qué proveedor vino.
 *
 * El parser conoce ESTE tipo y nunca la API de Gmail. Esa costura es la que
 * permite soportar Outlook mañana escribiendo otro fetcher, sin tocar una
 * sola línea de la lógica de parseo — que es donde está el valor y los bugs.
 */
export interface RawEmail {
  /** ID estable del proveedor. En Gmail es el message id; termina en source_ref. */
  id: string
  subject: string
  from: string
  /** Fecha en que llegó el correo, ISO 8601. */
  receivedAt: string
  /** Cuerpo en texto plano: ya decodificado de base64url y sin etiquetas HTML. */
  body: string
}

/** Qué movimiento anunció el correo. Se guarda para diagnóstico y para la UI. */
export type MovimientoBancolombia =
  | 'compra'
  | 'retiro'
  | 'transferencia_saliente'
  | 'transferencia_entrante'
  | 'pago_recibido'

/**
 * Lo que devuelve el parser: listo para insertar, pero todavía sin tocar la DB.
 * Mantener el parseo separado de la escritura es lo que lo hace testeable sin
 * red ni credenciales.
 */
export interface ParsedTransaction {
  /** income | expense — lo que entiende la tabla transactions. */
  kind: TransactionKind
  movimiento: MovimientoBancolombia
  /** SIEMPRE centavos. Un correo que dice $45.000 acá vale 4500000. */
  amount_cents: number
  merchant: string | null
  description: string
  /** ISO 8601. Sale del cuerpo si el correo trae fecha; si no, de receivedAt. */
  occurred_at: string
  /** = RawEmail.id. Es lo que garantiza idempotencia vía el índice único. */
  source_ref: string
}

/** Correo que ningún reconocedor supo leer. No es un error: es trabajo pendiente. */
export interface UnparsedEmail {
  id: string
  subject: string
  /** Por qué no se pudo parsear, en español y legible para un humano. */
  motivo: string
}

/** Respuesta del endpoint de tokens de Google. */
export interface GoogleTokens {
  access_token: string
  /** Sólo llega en el primer consentimiento (access_type=offline&prompt=consent). */
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

/** Resultado de una corrida de sincronización. Alimenta gmail_sync_log y la UI. */
export interface SyncResult {
  messagesSeen: number
  messagesSaved: number
  /** Correos que el índice único rechazó. Esperado: es la idempotencia funcionando. */
  duplicados: number
  noParseados: UnparsedEmail[]
  error: string | null
}
