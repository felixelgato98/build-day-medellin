import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { buildConsentUrl } from '@/features/gmail/google'

/**
 * Arranque del OAuth de Google: genera el `state`, lo deja en una cookie
 * httpOnly y manda al usuario a la pantalla de consentimiento.
 *
 * La contraparte es `/api/gmail/callback`, que compara el `state` del query
 * contra el de la cookie. Las dos rutas son una sola pieza: si cambiás el
 * nombre de la cookie o cómo se arma el redirect_uri acá, allá se rompe.
 */

/** Nombre acordado en CONTRACT.md: el callback lee exactamente esta cookie. */
const STATE_COOKIE = 'gmail_oauth_state'

/** Diez minutos alcanzan de sobra para autorizar; más tiempo es más ventana de ataque. */
const STATE_MAX_AGE_SECONDS = 600

// Lee cookies y la URL del request: nunca debe prerenderizarse ni cachearse.
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  // El origin sale del request y no de una variable de entorno para que
  // localhost y los previews de Vercel funcionen sin configurar nada. Google
  // compara el redirect_uri string contra string, así que el callback tiene que
  // armarlo idéntico: new URL('/api/gmail/callback', origin).
  const origin = new URL(request.url).origin
  const redirectUri = new URL('/api/gmail/callback', origin).toString()

  // Sin este state un atacante puede hacerte completar SU flujo y dejar SU
  // buzón conectado a TU cuenta. Va en cookie httpOnly para que ni un XSS lo
  // pueda leer y falsificar el callback.
  const state = crypto.randomUUID()

  let consentUrl: string
  try {
    consentUrl = buildConsentUrl({ redirectUri, state })
  } catch {
    // Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. La página traduce el
    // código a español; un 500 crudo en la cara no le dice nada a nadie.
    return NextResponse.redirect(new URL('/gmail?error=config', origin))
  }

  // En Next 16 cookies() es asíncrono.
  const jar = await cookies()
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    // 'lax' y no 'strict': Google nos devuelve desde otro sitio y con 'strict'
    // el navegador no mandaría la cookie en ese retorno, rompiendo el flujo.
    sameSite: 'lax',
    // En localhost no hay https, así que una cookie secure jamás llegaría.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_MAX_AGE_SECONDS,
  })

  return NextResponse.redirect(consentUrl)
}
