import 'server-only'

import type { GoogleTokens } from './types'

/**
 * El baile de OAuth con Google, a fetch pelado.
 *
 * Única pieza del módulo que conoce estos endpoints y las credenciales. Sin SDK:
 * son tres llamadas REST y meter una dependencia nueva costaría más de lo que
 * ahorra.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo'

/**
 * `gmail.readonly` es lo que pide el encargo; `userinfo.email` va aparte porque
 * el endpoint userinfo responde 403 sin él, y sin correo no hay forma de
 * mostrarle al usuario qué buzón quedó conectado.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

interface GoogleCredentials {
  clientId: string
  clientSecret: string
}

/**
 * Las credenciales se leen acá adentro y nunca en el top level del módulo: si se
 * leyeran al importar, `npm run build` reventaría en cualquier máquina o runner
 * sin .env.local aunque nadie llegue a llamar estas funciones.
 */
function leerCredenciales(): GoogleCredentials {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    const faltantes: string[] = []
    if (!clientId) faltantes.push('GOOGLE_CLIENT_ID')
    if (!clientSecret) faltantes.push('GOOGLE_CLIENT_SECRET')

    throw new Error(
      `Falta ${faltantes.join(' y ')} en el entorno. Creá un cliente OAuth de tipo ` +
        '"aplicación web" en console.cloud.google.com, agregá esas variables a ' +
        '.env.local (o a Vercel) y corré: vercel env pull .env.local',
    )
  }

  return { clientId, clientSecret }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

async function leerRespuesta(res: Response): Promise<unknown> {
  const texto = await res.text()
  if (texto.trim() === '') return null

  try {
    return JSON.parse(texto) as unknown
  } catch {
    // Los 5xx y los bloqueos de proxy llegan en HTML: devolver el texto crudo
    // hace que el error diga algo útil en vez de "unexpected token <".
    return texto
  }
}

/** Arma un detalle legible del error, venga en JSON de OAuth, de googleapis o en HTML. */
function describirError(payload: unknown, res: Response): string {
  const http = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`

  if (typeof payload === 'string') return `${http}: ${payload.slice(0, 200)}`

  if (esObjeto(payload)) {
    const { error, error_description } = payload

    if (typeof error === 'string') {
      return typeof error_description === 'string'
        ? `${error}: ${error_description}`
        : error
    }

    // googleapis anida el error: { error: { code, message, status } }
    if (esObjeto(error) && typeof error.message === 'string') {
      return error.message
    }
  }

  return http
}

/**
 * Valida la respuesta de tokens sin castear a ciegas: lo que vuelve de la red es
 * `unknown` hasta que se demuestre lo contrario.
 *
 * `refreshTokenPrevio` existe porque la respuesta del refresh no repite el
 * refresh_token, y quien llama necesita un GoogleTokens completo igual.
 */
function interpretarTokens(
  payload: unknown,
  refreshTokenPrevio?: string,
): GoogleTokens {
  if (!esObjeto(payload)) {
    throw new Error('Google devolvió una respuesta de tokens ilegible.')
  }

  const { access_token, refresh_token, expires_in, scope, token_type } = payload

  if (typeof access_token !== 'string' || access_token === '') {
    throw new Error(
      'Google respondió sin access_token. Revisá que el cliente OAuth sea de tipo ' +
        '"aplicación web" y que GOOGLE_CLIENT_SECRET sea el del mismo cliente.',
    )
  }

  const refresh =
    typeof refresh_token === 'string' && refresh_token !== ''
      ? refresh_token
      : refreshTokenPrevio

  return {
    access_token,
    ...(refresh ? { refresh_token: refresh } : {}),
    // Google siempre manda expires_in; el default evita que un campo ausente se
    // traduzca en una expiración calculada en el pasado y un refresh en loop.
    expires_in:
      typeof expires_in === 'number' && Number.isFinite(expires_in)
        ? expires_in
        : 3600,
    scope: typeof scope === 'string' ? scope : SCOPES,
    token_type: typeof token_type === 'string' ? token_type : 'Bearer',
  }
}

/** URL a la que se redirige al usuario para que autorice. */
export function buildConsentUrl(opts: {
  redirectUri: string
  state: string
}): string {
  const { clientId } = leerCredenciales()

  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('state', opts.state)
  // Sin estos dos Google entrega access_token pero NO refresh_token: el sync
  // andaría una hora y después habría que reconectar la cuenta a mano.
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')

  return url.toString()
}

/** Intercambia el `code` del callback por tokens. Lanza si Google responde error. */
export async function exchangeCodeForTokens(opts: {
  code: string
  redirectUri: string
}): Promise<GoogleTokens> {
  const { clientId, clientSecret } = leerCredenciales()

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      code: opts.code,
      client_id: clientId,
      client_secret: clientSecret,
      // Google compara este redirect_uri string contra string con el del
      // consentimiento: cualquier diferencia de puerto o barra final da invalid_grant.
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  })

  const payload = await leerRespuesta(res)

  if (!res.ok) {
    throw new Error(
      `Google rechazó el código de autorización (${describirError(payload, res)}). ` +
        `Verificá que ${opts.redirectUri} esté registrado tal cual en los "URI de ` +
        'redireccionamiento autorizados" del cliente OAuth.',
    )
  }

  return interpretarTokens(payload)
}

/** Canjea un refresh_token por un access_token nuevo. Lanza si fue revocado. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = leerCredenciales()

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })

  const payload = await leerRespuesta(res)

  if (!res.ok) {
    const detalle = describirError(payload, res)
    // invalid_grant acá significa permiso revocado o token vencido: reintentar no
    // sirve, hay que mandar al usuario a reconectar.
    const pista = detalle.includes('invalid_grant')
      ? ' El permiso fue revocado o expiró: reconectá la cuenta desde /gmail.'
      : ''

    throw new Error(`No se pudo renovar el acceso a Gmail (${detalle}).${pista}`)
  }

  return interpretarTokens(payload, refreshToken)
}

/** Correo de la cuenta que acaba de autorizar. Usa el endpoint userinfo. */
export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const payload = await leerRespuesta(res)

  if (!res.ok) {
    throw new Error(
      `Google no devolvió el correo de la cuenta (${describirError(payload, res)}).`,
    )
  }

  if (!esObjeto(payload) || typeof payload.email !== 'string' || payload.email === '') {
    throw new Error(
      'La respuesta de userinfo llegó sin email. Revisá que el consentimiento haya ' +
        'incluido el scope userinfo.email.',
    )
  }

  return payload.email
}
