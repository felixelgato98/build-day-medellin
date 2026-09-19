import 'server-only'

import { WORKSPACE_ID } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types'

import { fetchBancolombiaEmails } from './fetcher'
import { refreshAccessToken } from './google'
import { parseBancolombiaEmail } from './parser'
import type {
  ParsedTransaction,
  RawEmail,
  SyncResult,
  UnparsedEmail,
} from './types'

/**
 * Orquestación e ingesta del módulo Gmail.
 *
 * Es la única pieza que escribe en la base. El fetcher sabe de Gmail, el parser
 * sabe de Bancolombia, y acá se pegan los dos contra `transactions` — esa
 * costura es la que permite testear el parseo sin credenciales ni red.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>
type FilaTransaccion = Database['public']['Tables']['transactions']['Insert']

/** Un resultado en cero, para no repetir la forma del objeto en cada salida. */
const VACIO: SyncResult = {
  messagesSeen: 0,
  messagesSaved: 0,
  duplicados: 0,
  noParseados: [],
  error: null,
}

/**
 * Las variables se leen acá adentro y nunca al importar el módulo: si se
 * leyeran en el top level, `npm run build` reventaría en cualquier máquina o
 * runner sin .env.local aunque nadie llame estas funciones.
 */
function faltaSupabase(): boolean {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * La columna `raw` es jsonb y el tipo de la tabla pide un objeto indexable; una
 * interfaz de TS no lo es, así que se copia campo por campo en vez de castear.
 */
function aRaw(
  t: ParsedTransaction,
  correo: RawEmail | undefined,
): Record<string, unknown> {
  if (correo) {
    return {
      id: correo.id,
      subject: correo.subject,
      from: correo.from,
      receivedAt: correo.receivedAt,
      body: correo.body,
      movimiento: t.movimiento,
    }
  }

  // Entrada manual: no hay correo que guardar, pero dejar lo parseado igual da
  // evidencia de cómo se interpretó el texto el día que alguien reclame que el
  // monto quedó mal.
  return {
    movimiento: t.movimiento,
    amount_cents: t.amount_cents,
    merchant: t.merchant,
    occurred_at: t.occurred_at,
    source_ref: t.source_ref,
  }
}

/**
 * Inserta transacciones ya parseadas. Reutilizada por la entrada manual.
 *
 * `crudos` es opcional a propósito: el sync tiene el correo original y lo manda
 * para que quede en `raw`, mientras que quien pega un correo a mano llama con un
 * solo argumento, tal como dice el contrato.
 */
export async function ingestParsed(
  parsed: ParsedTransaction[],
  crudos?: ReadonlyMap<string, RawEmail>,
): Promise<{ saved: number; duplicados: number }> {
  if (parsed.length === 0) return { saved: 0, duplicados: 0 }

  if (faltaSupabase()) {
    throw new Error('Supabase no está configurado. Corré: vercel env pull .env.local')
  }

  // Dos correos con el mismo message-id dentro de la misma corrida chocan contra
  // el índice único en un solo INSERT. Sacarlos acá deja el conteo de duplicados
  // explicable en vez de depender de cómo Postgres resuelve el empate interno.
  const unicos = new Map<string, ParsedTransaction>()
  for (const t of parsed) {
    if (!unicos.has(t.source_ref)) unicos.set(t.source_ref, t)
  }
  const duplicadosEnLote = parsed.length - unicos.size

  const filas: FilaTransaccion[] = [...unicos.values()].map((t) => ({
    workspace_id: WORKSPACE_ID,
    kind: t.kind,
    amount_cents: t.amount_cents,
    description: t.description,
    merchant: t.merchant,
    occurred_at: t.occurred_at,
    source: 'gmail',
    source_ref: t.source_ref,
    raw: aRaw(t, crudos?.get(t.source_ref)),
  }))

  const supabase = await createClient()

  // `ignoreDuplicates` traduce a ON CONFLICT DO NOTHING, y con eso PostgREST
  // devuelve ÚNICAMENTE las filas que realmente entraron. Esa resta es el conteo
  // de duplicados: no son un error, son la idempotencia funcionando.
  const { data, error } = await supabase
    .from('transactions')
    .upsert(filas, {
      onConflict: 'workspace_id,source,source_ref',
      ignoreDuplicates: true,
    })
    .select('source_ref')

  if (error) {
    throw new Error(`No se pudieron guardar las transacciones: ${error.message}`)
  }

  const saved = data?.length ?? 0
  return { saved, duplicados: duplicadosEnLote + (filas.length - saved) }
}

/**
 * Abre la fila del log. Devuelve null si no se pudo: el log es diagnóstico y no
 * vale la pena tumbar una sincronización buena porque falló el diario.
 */
async function abrirLog(
  supabase: Cliente,
  accountId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('gmail_sync_log')
    .insert({
      workspace_id: WORKSPACE_ID,
      account_id: accountId,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) return null
  return data.id
}

async function cerrarLog(
  supabase: Cliente,
  logId: string | null,
  resultado: Pick<SyncResult, 'messagesSeen' | 'messagesSaved' | 'error'>,
): Promise<void> {
  if (!logId) return

  await supabase
    .from('gmail_sync_log')
    .update({
      finished_at: new Date().toISOString(),
      messages_seen: resultado.messagesSeen,
      messages_saved: resultado.messagesSaved,
      error: resultado.error,
    })
    .eq('id', logId)
}

/**
 * Corre una sincronización completa para una cuenta conectada.
 *
 * Nunca lanza: cualquier falla vuelve como `SyncResult.error`. Un throw acá
 * dejaría la fila del log abierta para siempre y le pintaría un 500 crudo en la
 * cara a quien apretó "Sincronizar ahora".
 */
export async function syncGmailAccount(opts: {
  accountId: string
  max?: number
}): Promise<SyncResult> {
  if (faltaSupabase()) {
    return {
      ...VACIO,
      error: 'Supabase no está configurado. Corré: vercel env pull .env.local',
    }
  }

  const supabase = await createClient()

  const { data: cuenta, error: errorCuenta } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('id', opts.accountId)
    .eq('workspace_id', WORKSPACE_ID)
    .maybeSingle()

  if (errorCuenta) {
    return { ...VACIO, error: `No se pudo leer la cuenta conectada: ${errorCuenta.message}` }
  }
  if (!cuenta) {
    return { ...VACIO, error: 'Esa cuenta de Gmail ya no está conectada. Volvé a conectarla.' }
  }

  // El log se abre recién acá y no antes: `account_id` tiene FK contra
  // gmail_accounts, así que una fila para una cuenta inexistente ni entraría.
  const logId = await abrirLog(supabase, cuenta.id)

  const refreshToken = cuenta.refresh_token
  if (!refreshToken) {
    const error =
      'La cuenta quedó sin refresh_token. Desconectala y volvé a conectarla ' +
      'para que Google mande uno nuevo.'
    await cerrarLog(supabase, logId, { messagesSeen: 0, messagesSaved: 0, error })
    return { ...VACIO, error }
  }

  let accessToken: string
  try {
    const tokens = await refreshAccessToken(refreshToken)
    accessToken = tokens.access_token
  } catch (e) {
    // Lo normal acá es que el usuario revocó el permiso desde su cuenta de
    // Google. No es un bug nuestro y no debería verse como una excepción.
    const error = `No se pudo renovar el acceso a Gmail: ${mensajeDeError(e)}`
    await cerrarLog(supabase, logId, { messagesSeen: 0, messagesSaved: 0, error })
    return { ...VACIO, error }
  }

  let correos: RawEmail[]
  try {
    correos = await fetchBancolombiaEmails({ accessToken, max: opts.max })
  } catch (e) {
    const error = `No se pudieron leer los correos: ${mensajeDeError(e)}`
    await cerrarLog(supabase, logId, { messagesSeen: 0, messagesSaved: 0, error })
    return { ...VACIO, error }
  }

  const parsed: ParsedTransaction[] = []
  const crudos = new Map<string, RawEmail>()
  const noParseados: UnparsedEmail[] = []

  for (const correo of correos) {
    const transaccion = parseBancolombiaEmail(correo)

    if (!transaccion) {
      noParseados.push({
        id: correo.id,
        subject: correo.subject,
        motivo:
          'Formato no reconocido: ningún reconocedor de Bancolombia pudo sacar ' +
          'el monto y el tipo de movimiento.',
      })
      continue
    }

    parsed.push(transaccion)
    crudos.set(transaccion.source_ref, correo)
  }

  let saved = 0
  let duplicados = 0
  let error: string | null = null

  try {
    const ingesta = await ingestParsed(parsed, crudos)
    saved = ingesta.saved
    duplicados = ingesta.duplicados
  } catch (e) {
    error = mensajeDeError(e)
  }

  if (!error) {
    // Sólo se sella la fecha cuando la corrida terminó bien: si la ingesta falló
    // no se guardó nada (el upsert es una sola sentencia) y marcarla mentiría
    // sobre cuándo se sincronizó por última vez.
    //
    // Que falle el update no invalida la corrida: los movimientos ya están
    // guardados y el próximo sync es idempotente igual, así que no se revisa.
    await supabase
      .from('gmail_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', cuenta.id)
  }

  const resultado: SyncResult = {
    messagesSeen: correos.length,
    messagesSaved: saved,
    duplicados,
    noParseados,
    error,
  }

  await cerrarLog(supabase, logId, resultado)
  return resultado
}
