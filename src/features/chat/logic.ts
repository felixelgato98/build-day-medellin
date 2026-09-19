/**
 * Lógica pura del módulo de chat: sin I/O, sin Supabase, sin AI SDK.
 * Todo lo que el modelo manda como texto o número se valida acá antes de
 * tocar la base de datos. Se prueba con `node --import tsx --test`.
 */

/** Pesos (como los piensa el modelo) -> centavos enteros. null si no sirve. */
export function pesosToCents(pesos: number): number | null {
  if (!Number.isFinite(pesos) || pesos <= 0) return null
  return Math.round(pesos * 100)
}

export interface CategoryLike {
  id: string
  name: string
  kind: 'income' | 'expense'
}

export type Resolved<T> = { ok: true; category: T } | { ok: false; error: string }

/** "  Educación " -> "educacion". Para comparar nombres como los escribe la gente. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Busca una categoría por nombre, tolerando mayúsculas, tildes y espacios.
 * Si `kind` viene, solo considera categorías de ese tipo. Cuando no encuentra,
 * el error lista las opciones válidas para que el modelo pueda corregir.
 */
export function resolveCategory<T extends CategoryLike>(
  categories: readonly T[],
  name: string,
  kind?: CategoryLike['kind'],
): Resolved<T> {
  const pool = kind ? categories.filter((c) => c.kind === kind) : categories
  const wanted = normalize(name)
  const found = pool.find((c) => normalize(c.name) === wanted)
  if (found) return { ok: true, category: found }

  const options = pool.map((c) => c.name).join(', ')
  return {
    ok: false,
    error: `No existe la categoría "${name.trim()}"${kind ? ` de tipo ${kind}` : ''}. Opciones: ${options}.`,
  }
}

export type Check = { ok: true } | { ok: false; error: string }

const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * El chat solo puede borrar lo que el chat (o la carga manual) creó hace poco.
 * Es la red de seguridad para deshacer un registro equivocado, no un borrador
 * general: lo de Gmail y efectivo lo administran sus módulos.
 */
export function canDeleteFromChat(
  tx: { source: string; created_at: string },
  now: Date = new Date(),
): Check {
  if (tx.source !== 'manual') {
    return {
      ok: false,
      error: `Desde el chat solo se borran movimientos manuales. Este es de origen "${tx.source}".`,
    }
  }
  const age = now.getTime() - new Date(tx.created_at).getTime()
  if (!(age >= 0 && age <= DELETE_WINDOW_MS)) {
    return {
      ok: false,
      error: 'Desde el chat solo se borran movimientos creados en las últimas 24 horas.',
    }
  }
  return { ok: true }
}

export type Range = { ok: true; from: string; to: string } | { ok: false; error: string }

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function parseBoundary(value: string, endOfDay: boolean): Date | null {
  const iso = DATE_ONLY.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : value
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Convierte lo que el modelo manda ("2026-09-01", ISO completo, o nada) en un
 * rango cerrado en ISO. Sin fechas: el mes en curso. Una fecha sin hora como
 * "hasta" cubre ese día entero, que es lo que la gente quiere decir.
 */
export function normalizeRange(
  input: { desde?: string; hasta?: string },
  now: Date = new Date(),
): Range {
  let from: Date
  let to: Date

  if (!input.desde && !input.hasta) {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  } else {
    const parsedFrom = input.desde ? parseBoundary(input.desde, false) : new Date(0)
    const parsedTo = input.hasta ? parseBoundary(input.hasta, true) : now
    if (!parsedFrom) return { ok: false, error: `Fecha "desde" inválida: "${input.desde}". Usá formato YYYY-MM-DD.` }
    if (!parsedTo) return { ok: false, error: `Fecha "hasta" inválida: "${input.hasta}". Usá formato YYYY-MM-DD.` }
    from = parsedFrom
    to = parsedTo
  }

  if (to.getTime() < from.getTime()) {
    return { ok: false, error: 'La fecha "hasta" es anterior a la fecha "desde".' }
  }
  return { ok: true, from: from.toISOString(), to: to.toISOString() }
}

/**
 * Traduce un error del stream (gateway, red, modelo) a algo que el usuario
 * pueda leer. Nunca devuelve el mensaje crudo de un error desconocido: puede
 * traer rutas, tokens o stack traces.
 */
export function describeStreamError(err: unknown): string {
  const e = err as { message?: unknown; statusCode?: unknown } | null
  const message = typeof e?.message === 'string' ? e.message : ''
  const status = typeof e?.statusCode === 'number' ? e.statusCode : undefined

  if (/free tier|restricted ?model|upgrade to paid/i.test(message)) {
    return 'El AI Gateway rechazó el modelo: la cuenta de Vercel está en plan gratuito y no tiene créditos para este modelo.'
  }
  if (status === 401 || status === 403 || /unauthorized|forbidden|api key/i.test(message)) {
    return 'El AI Gateway rechazó las credenciales. Revisá AI_GATEWAY_API_KEY o el enlace del proyecto con Vercel.'
  }
  if (status === 429 || /rate limit|too many requests/i.test(message)) {
    return 'El AI Gateway está limitando las peticiones. Esperá un momento e intentá de nuevo.'
  }
  return 'El asistente no pudo responder por un error de conexión. Intentá de nuevo en unos segundos.'
}
