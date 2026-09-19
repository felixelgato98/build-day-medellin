import 'server-only'

import type { RawEmail } from './types'

/**
 * La API de Gmail, a fetch pelado.
 *
 * Única pieza del módulo que sabe que Gmail existe. Todo lo que sale de acá es
 * `RawEmail`: esa costura es la que permite soportar Outlook mañana escribiendo
 * otro fetcher sin tocar una línea del parser, que es donde están los bugs.
 */

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'

/** Tope duro de la API por página. Pedir más devuelve 400. */
const PAGINA_MAX = 500

/** Guarda contra un `nextPageToken` que se repite: sin esto el loop no termina. */
const PAGINAS_MAX = 20

const MAX_POR_DEFECTO = 50

/**
 * `messages.get` cuesta 5 unidades de cuota y el límite es 250/segundo por
 * usuario. Cinco en paralelo va ~5x más rápido que en serie y queda lejísimos
 * del techo; subirlo sólo compra 429s y backoff.
 */
const CONCURRENCIA = 5

const REINTENTOS_MAX = 3
const ESPERA_BASE_MS = 500
const ESPERA_TOPE_MS = 8_000

/**
 * Query por defecto contra el buzón. Exportada para poder testearla y ajustarla.
 *
 * El filtro de palabras cubre los cinco formatos del contrato; Gmail ignora
 * tildes al buscar, así que "recepcion" también encuentra "Recepción". La cota
 * de fecha es para que la búsqueda no barra diez años de buzón cuando alguien
 * pida un `max` grande.
 */
export const BANCOLOMBIA_QUERY = [
  'from:bancolombia.com.co',
  '(compra OR retiro OR transferencia OR "pago recibido" OR recepcion)',
  'newer_than:1y',
].join(' ')

// ---------------------------------------------------------------------------
// Lectura defensiva de JSON ajeno
//
// Lo que vuelve de la red es `unknown` hasta que se demuestre lo contrario.
// Estos accesores recorren la respuesta sin castear: si Google cambia un campo,
// acá sale un string vacío y no un TypeError en producción.
// ---------------------------------------------------------------------------

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function texto(valor: unknown, clave: string): string {
  if (!esObjeto(valor)) return ''
  const campo = valor[clave]
  return typeof campo === 'string' ? campo : ''
}

function lista(valor: unknown, clave: string): unknown[] {
  if (!esObjeto(valor)) return []
  const campo = valor[clave]
  return Array.isArray(campo) ? campo : []
}

function objeto(valor: unknown, clave: string): unknown {
  return esObjeto(valor) ? valor[clave] : null
}

// ---------------------------------------------------------------------------
// HTTP con backoff
// ---------------------------------------------------------------------------

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Cuánto esperar antes del reintento `intento` (0-based). */
function esperaDe(intento: number, res: Response | null): number {
  // Si Google dice cuánto esperar, adivinar es peor que hacerle caso.
  const cabecera = res?.headers.get('retry-after') ?? null
  if (cabecera !== null) {
    const segundos = Number(cabecera)
    if (Number.isFinite(segundos) && segundos > 0) {
      return Math.min(segundos * 1000, ESPERA_TOPE_MS)
    }
    const fecha = Date.parse(cabecera)
    if (!Number.isNaN(fecha) && fecha > Date.now()) {
      return Math.min(fecha - Date.now(), ESPERA_TOPE_MS)
    }
  }

  const exponencial = Math.min(ESPERA_BASE_MS * 2 ** intento, ESPERA_TOPE_MS)
  // Jitter: los 5 pedidos de una tanda fallan juntos, y sin ruido reintentarían
  // juntos y se volverían a chocar contra el mismo 429.
  return exponencial / 2 + Math.random() * (exponencial / 2)
}

async function leerRespuesta(res: Response): Promise<unknown> {
  const cuerpo = await res.text()
  if (cuerpo.trim() === '') return null

  try {
    return JSON.parse(cuerpo) as unknown
  } catch {
    // Los 5xx y los bloqueos de proxy llegan en HTML: devolver el texto crudo
    // hace que el error diga algo útil en vez de "unexpected token <".
    return cuerpo.slice(0, 300)
  }
}

/** googleapis anida el error: { error: { code, message, status, errors:[{reason}] } }. */
function describirError(payload: unknown, res: Response): string {
  const http = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`
  if (typeof payload === 'string') return `${http}: ${payload}`

  const error = objeto(payload, 'error')
  const mensaje = texto(error, 'message')
  if (mensaje !== '') return mensaje

  const suelto = texto(payload, 'error')
  return suelto !== '' ? suelto : http
}

function razonDeError(payload: unknown): string {
  const error = objeto(payload, 'error')
  const primero = lista(error, 'errors')[0]
  return texto(primero, 'reason') || texto(error, 'status')
}

/**
 * Gmail devuelve 403 para dos cosas muy distintas: te pasaste de cuota (pasa y
 * se resuelve solo) o no tenés el scope (no se resuelve nunca). Reintentar el
 * primero es correcto; reintentar el segundo son tres esperas al pedo.
 */
function esCuota(res: Response, payload: unknown): boolean {
  if (res.status !== 403) return false
  const razon = razonDeError(payload).toLowerCase()
  return razon.includes('ratelimitexceeded') || razon.includes('quotaexceeded')
}

function mensajeFatal(res: Response, payload: unknown): string {
  const detalle = describirError(payload, res)

  if (res.status === 401) {
    return `Gmail rechazó el acceso (${detalle}). El token venció o el permiso fue revocado: reconectá la cuenta desde /gmail.`
  }
  if (res.status === 403) {
    return `Gmail negó el permiso (${detalle}). Revisá que el consentimiento haya incluido el scope gmail.readonly.`
  }
  if (res.status === 400) {
    return `Gmail rechazó la consulta (${detalle}). Suele ser una query mal formada.`
  }
  return `Gmail respondió con error (${detalle}).`
}

/**
 * GET contra la API con reintentos ante 429, 5xx y caídas de red.
 * Cualquier otro error se propaga: no hay backoff que arregle un scope faltante.
 *
 * Con `permitir404` devuelve null en vez de lanzar, para el único caso en que
 * un 404 es esperable: el mensaje se borró entre el list y el get.
 */
async function pedirJson(
  url: string,
  accessToken: string,
  permitir404 = false,
): Promise<unknown> {
  let ultimoDetalle = ''

  for (let intento = 0; intento <= REINTENTOS_MAX; intento++) {
    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      })
    } catch (error) {
      // Un fallo de red es transitorio por definición: reintentarlo sí sirve.
      ultimoDetalle = error instanceof Error ? error.message : String(error)
      if (intento === REINTENTOS_MAX) break
      await dormir(esperaDe(intento, null))
      continue
    }

    if (res.ok) return leerRespuesta(res)

    const payload = await leerRespuesta(res)

    if (res.status === 404 && permitir404) return null

    if (res.status === 429 || res.status >= 500 || esCuota(res, payload)) {
      ultimoDetalle = describirError(payload, res)
      if (intento === REINTENTOS_MAX) break
      await dormir(esperaDe(intento, res))
      continue
    }

    throw new Error(mensajeFatal(res, payload))
  }

  throw new Error(
    `Gmail no respondió después de ${REINTENTOS_MAX + 1} intentos (${ultimoDetalle}). ` +
      'Probá de nuevo en un minuto.',
  )
}

// ---------------------------------------------------------------------------
// Decodificación del cuerpo
// ---------------------------------------------------------------------------

/**
 * base64url: Gmail usa `-` y `_` donde base64 usa `+` y `/`, y recorta el
 * relleno. Sin reponer el `=` faltante, atob tira sobre cuerpos cuyo largo no
 * es múltiplo de 4 — que son tres de cada cuatro.
 */
function decodificarBase64Url(datos: string, charset: string): string {
  if (datos === '') return ''

  const limpio = datos.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const relleno = '='.repeat((4 - (limpio.length % 4)) % 4)

  try {
    const binaria = atob(limpio + relleno)
    const bytes = new Uint8Array(binaria.length)
    for (let i = 0; i < binaria.length; i++) bytes[i] = binaria.charCodeAt(i)

    try {
      return new TextDecoder(charset).decode(bytes)
    } catch {
      // Charset raro o inventado: UTF-8 es la apuesta correcta hoy.
      return new TextDecoder('utf-8').decode(bytes)
    }
  } catch {
    // Un cuerpo corrupto no puede tumbar la corrida entera de 50 correos.
    return ''
  }
}

/** Charset del Content-Type de la parte. Importa: en latin-1, "Recepción" llega rota. */
function charsetDe(contentType: string): string {
  const match = /charset\s*=\s*"?([\w-]+)"?/i.exec(contentType)
  return match?.[1] ?? 'utf-8'
}

function encabezado(parte: unknown, nombre: string): string {
  const buscado = nombre.toLowerCase()
  for (const cabecera of lista(parte, 'headers')) {
    if (texto(cabecera, 'name').toLowerCase() === buscado) {
      return texto(cabecera, 'value')
    }
  }
  return ''
}

/** Primera parte del árbol MIME con ese tipo y contenido. Los adjuntos no cuentan. */
function buscarParte(parte: unknown, mimeType: string): unknown {
  if (!esObjeto(parte)) return null

  const esAdjunto = texto(parte, 'filename') !== ''
  const tieneDatos = texto(objeto(parte, 'body'), 'data') !== ''

  if (!esAdjunto && tieneDatos && texto(parte, 'mimeType').toLowerCase() === mimeType) {
    return parte
  }

  for (const hija of lista(parte, 'parts')) {
    const hallada = buscarParte(hija, mimeType)
    if (hallada !== null) return hallada
  }

  return null
}

function decodificarParte(parte: unknown): string {
  return decodificarBase64Url(
    texto(objeto(parte, 'body'), 'data'),
    charsetDe(encabezado(parte, 'Content-Type')),
  )
}

const ENTIDADES: Record<string, string | undefined> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  deg: '°',
  iexcl: '¡',
  iquest: '¿',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  uuml: 'ü',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ',
  Uuml: 'Ü',
}

function decodificarEntidades(fuente: string): string {
  return fuente.replace(
    /&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (completa: string, cuerpo: string): string => {
      if (cuerpo.startsWith('#')) {
        const hex = cuerpo[1] === 'x' || cuerpo[1] === 'X'
        const codigo = Number.parseInt(hex ? cuerpo.slice(2) : cuerpo.slice(1), hex ? 16 : 10)
        if (!Number.isFinite(codigo) || codigo <= 0 || codigo > 0x10ffff) return completa
        try {
          return String.fromCodePoint(codigo)
        } catch {
          return completa
        }
      }
      return ENTIDADES[cuerpo] ?? ENTIDADES[cuerpo.toLowerCase()] ?? completa
    },
  )
}

/**
 * HTML a texto. Los cierres de bloque se vuelven saltos de línea antes de
 * borrar las etiquetas: si no, "Compra por $45.000" y la fecha de la fila de
 * abajo quedan pegadas en un renglón y el regex del parser agarra cualquier cosa.
 */
function quitarHtml(html: string): string {
  const sinInvisibles = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|head|title)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')

  const conSaltos = sinInvisibles
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)>/gi, '\n')

  return decodificarEntidades(conSaltos.replace(/<[^>]+>/g, ' '))
}

/**
 * El `&nbsp;` de las plantillas HTML y los invisibles de los trackers entran en
 * `\s` pero no son espacios comunes: normalizarlos acá le ahorra al parser tener
 * que contemplarlos en cada regex.
 */
function normalizarTexto(fuente: string): string {
  return fuente
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍⁠﻿­]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cuerpoDe(raiz: unknown, snippet: string): string {
  const plano = buscarParte(raiz, 'text/plain')
  if (plano !== null) {
    const contenido = normalizarTexto(decodificarParte(plano))
    if (contenido !== '') return contenido
  }

  const html = buscarParte(raiz, 'text/html')
  if (html !== null) {
    const contenido = normalizarTexto(quitarHtml(decodificarParte(html)))
    if (contenido !== '') return contenido
  }

  // Último recurso. Viene recortado y con entidades, pero un cuerpo corto deja
  // evidencia en `raw` de por qué el correo no parseó; vacío no deja nada.
  return normalizarTexto(decodificarEntidades(snippet))
}

/**
 * `internalDate` le gana al header `Date`: el header lo escribe quien manda y
 * puede venir en cualquier zona o directamente mentido; internalDate es el
 * instante en que Gmail lo recibió.
 */
function fechaDeRecepcion(mensaje: unknown, raiz: unknown): string {
  const interno = Number(texto(mensaje, 'internalDate'))
  if (Number.isFinite(interno) && interno > 0) {
    return new Date(interno).toISOString()
  }

  const cabecera = Date.parse(encabezado(raiz, 'Date'))
  if (!Number.isNaN(cabecera)) return new Date(cabecera).toISOString()

  return new Date().toISOString()
}

function aRawEmail(mensaje: unknown): RawEmail | null {
  // El id del mensaje, nunca el threadId: el thread agrupa varios correos y
  // usarlo como source_ref haría que el segundo movimiento del hilo se guardara
  // como duplicado del primero.
  const id = texto(mensaje, 'id')
  if (id === '') return null

  const raiz = objeto(mensaje, 'payload')

  return {
    id,
    subject: encabezado(raiz, 'Subject') || '(sin asunto)',
    from: encabezado(raiz, 'From'),
    receivedAt: fechaDeRecepcion(mensaje, raiz),
    body: cuerpoDe(raiz, texto(mensaje, 'snippet')),
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

async function listarIds(
  accessToken: string,
  query: string,
  max: number,
): Promise<string[]> {
  const ids: string[] = []
  let pageToken = ''

  for (let pagina = 0; pagina < PAGINAS_MAX && ids.length < max; pagina++) {
    const url = new URL(`${GMAIL_API}/users/me/messages`)
    url.searchParams.set('q', query)
    url.searchParams.set('maxResults', String(Math.min(max - ids.length, PAGINA_MAX)))
    if (pageToken !== '') url.searchParams.set('pageToken', pageToken)

    const payload = await pedirJson(url.toString(), accessToken)

    for (const mensaje of lista(payload, 'messages')) {
      if (ids.length >= max) break
      const id = texto(mensaje, 'id')
      if (id !== '') ids.push(id)
    }

    const siguiente = texto(payload, 'nextPageToken')
    // Gmail puede devolver una página más corta que maxResults y seguir
    // teniendo resultados, así que el corte es el token, no la cantidad.
    if (siguiente === '' || siguiente === pageToken) break
    pageToken = siguiente
  }

  return ids
}

async function obtenerCorreo(
  accessToken: string,
  id: string,
): Promise<RawEmail | null> {
  const url = new URL(`${GMAIL_API}/users/me/messages/${encodeURIComponent(id)}`)
  url.searchParams.set('format', 'full')

  const mensaje = await pedirJson(url.toString(), accessToken, true)
  return mensaje === null ? null : aRawEmail(mensaje)
}

export async function fetchBancolombiaEmails(opts: {
  accessToken: string
  /** Tope de correos a traer en una corrida. Por defecto 50. */
  max?: number
  /** Query de Gmail. Por defecto BANCOLOMBIA_QUERY. */
  query?: string
}): Promise<RawEmail[]> {
  const accessToken = opts.accessToken.trim()
  if (accessToken === '') {
    throw new Error(
      'fetchBancolombiaEmails necesita un access_token. Renovalo con refreshAccessToken() antes de llamar.',
    )
  }

  const max = Math.trunc(opts.max ?? MAX_POR_DEFECTO)
  if (!Number.isFinite(max) || max <= 0) return []

  const query = opts.query?.trim() || BANCOLOMBIA_QUERY

  const ids = await listarIds(accessToken, query, max)
  const correos: RawEmail[] = []

  for (let i = 0; i < ids.length; i += CONCURRENCIA) {
    const tanda = await Promise.all(
      ids.slice(i, i + CONCURRENCIA).map((id) => obtenerCorreo(accessToken, id)),
    )
    for (const correo of tanda) {
      if (correo !== null) correos.push(correo)
    }
  }

  return correos
}
