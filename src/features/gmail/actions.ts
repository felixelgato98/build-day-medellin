'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { WORKSPACE_ID } from '@/lib/constants'
import { formatCOP } from '@/lib/money'
import { getCurrentUser } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'

import { parseBancolombiaEmail } from './parser'
import { ingestParsed, syncGmailAccount } from './sync'
import type { RawEmail, SyncResult } from './types'

/**
 * Server Actions del módulo Gmail.
 *
 * Toda escritura revalida `/gmail` **y** `/`: el Dashboard del módulo 1 lee las
 * mismas transacciones, y sin la segunda revalidación muestra el balance viejo
 * después de un sync.
 */

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

/**
 * Se valida con regex y no con `z.uuid()` porque la API de zod cambió de lugar
 * ese validador entre v3 y v4, y este archivo no puede permitirse romperse por
 * un bump de versión de la base compartida.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EsquemaAccountId = z.string().regex(UUID, 'El id de la cuenta no es válido.')

const EsquemaCorreoPegado = z.object({
  texto: z
    .string()
    .trim()
    .min(20, 'Pegá el correo completo: con ese pedazo no alcanza para leer el monto.')
    .max(20000, 'Ese texto es demasiado largo para ser un correo de Bancolombia.'),
  asunto: z.string().trim().max(500).optional(),
  remitente: z.string().trim().max(320).optional(),
})

/**
 * El formulario lo escribe otra pieza del módulo, así que se aceptan los
 * nombres de campo razonables en vez de casarse con uno solo y fallar en
 * silencio si no coincide.
 */
function leerCampo(formData: FormData, ...nombres: string[]): string | undefined {
  for (const nombre of nombres) {
    const valor = formData.get(nombre)
    if (typeof valor === 'string' && valor.trim() !== '') return valor
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Hash del correo pegado
// ---------------------------------------------------------------------------

/**
 * Un correo pegado a mano no trae message-id, y sin `source_ref` estable el
 * índice único no puede hacer su trabajo: pegar el mismo correo dos veces
 * duplicaría el gasto. Por eso el id sale del contenido.
 *
 * FNV-1a de 32 bits en dos pasadas con semillas distintas (64 bits efectivos).
 * Determinista, sin dependencias y sin async: `crypto.subtle.digest` obligaría
 * a esperar una promesa para algo que se resuelve con dos multiplicaciones.
 */
function hashEstable(texto: string): string {
  const semillas = [0x811c9dc5, 0x7fffffff]

  return semillas
    .map((semilla) => {
      let h = semilla
      for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
      }
      return (h >>> 0).toString(16).padStart(8, '0')
    })
    .join('')
}

/**
 * Normaliza antes de hashear para que el mismo correo pegado dos veces dé el
 * mismo id aunque el portapapeles haya metido saltos de línea o espacios de
 * más — que es exactamente lo que pasa al copiar desde la app de Gmail.
 */
function normalizarParaHash(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linea) => linea.replace(/\s+/g, ' ').trim())
    .filter((linea) => linea !== '')
    .join('\n')
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

function sinDatos(error: string): SyncResult {
  return {
    messagesSeen: 0,
    messagesSaved: 0,
    duplicados: 0,
    noParseados: [],
    error,
  }
}

/** Corre el sync de la cuenta del usuario y revalida las vistas afectadas. */
export async function sincronizarAhora(): Promise<SyncResult> {
  const user = await getCurrentUser()
  if (!user) {
    return sinDatos('Iniciá sesión para sincronizar tu correo.')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gmail_accounts')
    .select('id')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return sinDatos(`No pudimos leer tu cuenta conectada: ${error.message}`)
  }

  const accountId = EsquemaAccountId.safeParse(data?.id)
  if (!accountId.success) {
    return sinDatos('Todavía no conectaste una cuenta de Gmail.')
  }

  // syncGmailAccount ya devuelve el error adentro del SyncResult, pero una
  // caída de red o de la DB sí lanza: acá se atrapa para que el botón muestre
  // el motivo en vez de la pantalla de error de Next.
  let resultado: SyncResult
  try {
    resultado = await syncGmailAccount({ accountId: accountId.data })
  } catch (e) {
    resultado = sinDatos(
      e instanceof Error ? e.message : 'La sincronización falló por un motivo desconocido.',
    )
  }

  revalidatePath('/gmail')
  revalidatePath('/')

  return resultado
}

/** Borra la cuenta conectada del usuario. No borra las transacciones ya creadas. */
export async function desconectarCuenta(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Iniciá sesión para desconectar la cuenta.')
  }

  const supabase = await createClient()
  // Se borra sólo la fila de gmail_accounts: las transacciones ya importadas
  // son plata real del usuario y no desaparecen porque revoque el acceso.
  const { error } = await supabase
    .from('gmail_accounts')
    .delete()
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(`No pudimos desconectar la cuenta: ${error.message}`)
  }

  revalidatePath('/gmail')
  revalidatePath('/')
}

/** Escape hatch y herramienta de debug: parsea texto pegado a mano. */
export async function procesarCorreoPegado(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; mensaje: string }> {
  const entrada = EsquemaCorreoPegado.safeParse({
    texto: leerCampo(formData, 'texto', 'correo', 'cuerpo', 'body', 'email'),
    asunto: leerCampo(formData, 'asunto', 'subject'),
    remitente: leerCampo(formData, 'remitente', 'from', 'de'),
  })

  if (!entrada.success) {
    const problema = entrada.error.issues[0]
    return {
      ok: false,
      mensaje: problema?.message ?? 'Pegá el texto del correo de Bancolombia.',
    }
  }

  const { texto, asunto, remitente } = entrada.data
  const normalizado = normalizarParaHash(texto)

  const correo: RawEmail = {
    id: `pegado:${hashEstable(normalizado)}`,
    // La primera línea suele ser el asunto cuando se copia el correo entero.
    subject: asunto ?? normalizado.split('\n')[0]?.slice(0, 200) ?? 'Correo pegado a mano',
    from: remitente ?? 'pegado-a-mano@bancolombia',
    receivedAt: new Date().toISOString(),
    body: normalizado,
  }

  const parsed = parseBancolombiaEmail(correo)
  if (!parsed) {
    return {
      ok: false,
      mensaje:
        'No reconocimos ese formato. Revisá que el texto tenga el monto y el comercio tal como los manda Bancolombia.',
    }
  }

  try {
    const { saved, duplicados } = await ingestParsed([parsed])

    revalidatePath('/gmail')
    revalidatePath('/')

    if (duplicados > 0 && saved === 0) {
      return {
        ok: true,
        mensaje: 'Ese correo ya estaba registrado: no lo duplicamos.',
      }
    }

    const destino = parsed.merchant ? ` en ${parsed.merchant}` : ''
    return {
      ok: true,
      mensaje: `Listo: ${formatCOP(parsed.amount_cents)}${destino} (${parsed.movimiento.replace(/_/g, ' ')}).`,
    }
  } catch (e) {
    return {
      ok: false,
      mensaje: e instanceof Error ? e.message : 'No pudimos guardar el movimiento.',
    }
  }
}
