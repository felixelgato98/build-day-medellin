import { NextResponse, type NextRequest } from 'next/server'

import { exchangeCodeForTokens, fetchGoogleEmail } from '@/features/gmail/google'
import type { GoogleTokens } from '@/features/gmail/types'
import { WORKSPACE_ID } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types'

/**
 * Vuelta del baile de OAuth: Google manda acá al usuario con `code` y `state`.
 *
 * Códigos que puede devolver en `/gmail?error=` (la página los traduce):
 *
 * | código               | qué pasó                                              |
 * |----------------------|-------------------------------------------------------|
 * | `oauth_denegado`     | el usuario le dijo que no a Google                     |
 * | `oauth_google`       | Google abortó el consentimiento por otra razón         |
 * | `state_invalido`     | el state no coincide con la cookie (posible CSRF)      |
 * | `sin_codigo`         | volvió sin `code`                                      |
 * | `sin_supabase`       | falta configurar la base                               |
 * | `sin_sesion`         | no hay usuario logueado al que colgarle la cuenta      |
 * | `token_google`       | falló el intercambio de `code` por tokens              |
 * | `sin_permiso_gmail`  | autorizó, pero desmarcó el permiso de lectura de Gmail |
 * | `correo_google`      | no se pudo saber qué buzón autorizó                    |
 * | `sin_refresh_token`  | no hay refresh token: el sync viviría una hora         |
 * | `no_guardado`        | la escritura en `gmail_accounts` falló                 |
 */

/** Tiene que ser la misma que graba `/api/gmail/auth`: el contrato la fija así. */
const STATE_COOKIE = 'gmail_oauth_state'

/** Sin este scope el fetcher no puede leer un solo correo. */
const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.readonly'

type GmailAccountInsert = Database['public']['Tables']['gmail_accounts']['Insert']

/**
 * Comparación de tiempo constante: no filtra en qué carácter dejaron de
 * parecerse. Cuesta nada y ahorra tener que razonar si el state es adivinable.
 */
function mismoState(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let diferencia = 0
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return diferencia === 0
}

/**
 * El state es de un solo uso: se borra pase lo que pase, también cuando el
 * intento falla, para que nadie pueda reusarlo en un segundo callback.
 *
 * Se borra en los dos paths porque el navegador los distingue: si `/auth` lo
 * grabó sin `path` explícito, quedó guardado bajo `/api/gmail` y borrarlo sólo
 * en `/` lo dejaría vivo hasta que expire.
 */
function limpiarState(response: NextResponse): NextResponse {
  for (const path of ['/', '/api/gmail']) {
    response.cookies.set({
      name: STATE_COOKIE,
      value: '',
      path,
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
    })
  }

  return response
}

function redirigirAGmail(request: NextRequest, codigoDeError?: string): NextResponse {
  const destino = new URL('/gmail', request.nextUrl.origin)
  if (codigoDeError) destino.searchParams.set('error', codigoDeError)

  // Siempre un redirect: un 500 crudo en la cara del usuario, después de
  // mandarlo a Google y traerlo de vuelta, no le dice nada ni le deja salida.
  return limpiarState(NextResponse.redirect(destino))
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams

  // Google no avisa el rechazo con un status: lo manda por query. Sin esta
  // rama seguiríamos al intercambio con un `code` vacío y el error sería otro.
  const errorDeGoogle = params.get('error')
  if (errorDeGoogle) {
    return redirigirAGmail(
      request,
      errorDeGoogle === 'access_denied' ? 'oauth_denegado' : 'oauth_google',
    )
  }

  const state = params.get('state')
  const stateEsperado = request.cookies.get(STATE_COOKIE)?.value

  // ESTO VA PRIMERO, ANTES DE TOCAR NADA MÁS. Es la defensa anti-CSRF: sin
  // comparar, un atacante te hace abrir su propio callback y terminás con SU
  // buzón colgado de TU cuenta, sincronizando movimientos ajenos como tuyos.
  if (!state || !stateEsperado || !mismoState(state, stateEsperado)) {
    return redirigirAGmail(request, 'state_invalido')
  }

  const code = params.get('code')
  if (!code) return redirigirAGmail(request, 'sin_codigo')

  // El entorno se lee acá adentro y nunca al importar el módulo: si se leyera
  // arriba, `npm run build` reventaría en cualquier runner sin .env.local.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return redirigirAGmail(request, 'sin_supabase')
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: errorDeSesion,
  } = await supabase.auth.getUser()

  if (errorDeSesion || !user) return redirigirAGmail(request, 'sin_sesion')

  // Tiene que ser idéntico al que usó `/api/gmail/auth`: Google lo compara
  // string contra string y cualquier diferencia es `redirect_uri_mismatch`.
  const redirectUri = new URL('/api/gmail/callback', request.nextUrl.origin).toString()

  let tokens: GoogleTokens
  try {
    tokens = await exchangeCodeForTokens({ code, redirectUri })
  } catch (e) {
    console.error('[gmail/callback] falló el intercambio de code por tokens', e)
    return redirigirAGmail(request, 'token_google')
  }

  // Google deja desmarcar permisos de a uno en la pantalla de consentimiento.
  // Si el de Gmail quedó afuera, la cuenta se guardaría "conectada" y recién
  // al primer sync aparecería un 403 sin explicación.
  if (!tokens.scope.split(' ').includes(SCOPE_GMAIL)) {
    return redirigirAGmail(request, 'sin_permiso_gmail')
  }

  let email: string
  try {
    email = await fetchGoogleEmail(tokens.access_token)
  } catch (e) {
    console.error('[gmail/callback] no se pudo leer el correo de la cuenta', e)
    return redirigirAGmail(request, 'correo_google')
  }

  const { data: cuentaExistente, error: errorDeLectura } = await supabase
    .from('gmail_accounts')
    .select('refresh_token')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)
    .eq('email', email)
    .maybeSingle()

  if (errorDeLectura) {
    console.error('[gmail/callback] no se pudo leer la cuenta existente', errorDeLectura)
    return redirigirAGmail(request, 'no_guardado')
  }

  // Google manda `refresh_token` sólo en el primer consentimiento. Cuando no
  // viene, se conserva el que ya estaba: pisarlo con null deja la cuenta
  // sincronizando una hora y después muerta, sin que nadie entienda por qué.
  const refreshToken = tokens.refresh_token ?? cuentaExistente?.refresh_token ?? null

  if (!refreshToken) {
    return redirigirAGmail(request, 'sin_refresh_token')
  }

  const cuenta: GmailAccountInsert = {
    workspace_id: WORKSPACE_ID,
    user_id: user.id,
    email,
    // TODO(seguridad): el refresh token queda en texto plano. Para el build day
    // pasa; antes de producción va cifrado (pgcrypto o un KMS) y con la policy
    // de RLS complementada por una columna que el cliente no pueda leer.
    refresh_token: refreshToken,
  }

  // La tabla tiene unique (workspace_id, email): reconectar el mismo buzón
  // actualiza la fila en vez de fallar, que es lo que pasa siempre que alguien
  // vuelve a apretar "Conectar" por las dudas.
  const { error: errorDeEscritura } = await supabase
    .from('gmail_accounts')
    .upsert(cuenta, { onConflict: 'workspace_id,email' })

  if (errorDeEscritura) {
    console.error('[gmail/callback] no se pudo guardar la cuenta', errorDeEscritura)
    return redirigirAGmail(request, 'no_guardado')
  }

  return redirigirAGmail(request)
}
