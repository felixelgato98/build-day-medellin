import type { ReactNode } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { desconectarCuenta } from '@/features/gmail/actions'
import type { GmailAccount } from '@/lib/types'

/**
 * Traducción de los `?error=` que manda el callback de OAuth.
 *
 * Vive acá y no en las rutas porque la ruta redirige antes de poder renderizar
 * nada: lo único que puede viajar en una URL es un código corto. La frase que
 * lee el humano se arma en el único lugar que sabe de UI, que es este.
 */
const MENSAJES_ERROR: Record<string, string> = {
  config:
    'Faltan las credenciales de Google en el servidor. Revisá GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.',
  state:
    'La autorización no coincidió con la que iniciaste desde acá y se canceló por seguridad. Volvé a intentar sin abrir el enlace en otra pestaña.',
  state_invalido:
    'La autorización no coincidió con la que iniciaste desde acá y se canceló por seguridad. Volvé a intentar sin abrir el enlace en otra pestaña.',
  access_denied: 'Cancelaste el permiso en la pantalla de Google. No se conectó nada.',
  acceso_denegado: 'Cancelaste el permiso en la pantalla de Google. No se conectó nada.',
  sin_codigo: 'Google no devolvió el código de autorización. Volvé a intentar.',
  token: 'Google rechazó el intercambio de tokens. Volvé a conectar la cuenta.',
  sin_refresh_token:
    'Google no envió el permiso de larga duración, así que el sync dejaría de funcionar en una hora. Desconectá y volvé a autorizar aceptando todos los permisos.',
  userinfo: 'No se pudo leer el correo de la cuenta autorizada. Volvé a intentar.',
  db: 'La cuenta se autorizó pero no se pudo guardar. Revisá la conexión con Supabase.',
  no_autenticado: 'Tenés que iniciar sesión en la app antes de conectar Gmail.',
}

/**
 * Los códigos son cortos y sin espacios; cualquier otra cosa ya es una frase
 * que alguien escribió para ser leída, y reescribirla sería perder información.
 */
function traducirError(error: string): string {
  const codigo = error.trim()
  const conocido = MENSAJES_ERROR[codigo]
  if (conocido) return conocido
  if (codigo.includes(' ')) return codigo
  return `No se pudo conectar la cuenta (${codigo}). Volvé a intentar.`
}

/**
 * Una fecha guardada puede venir corrupta de la DB; `new Date` no lanza, se
 * queda en Invalid Date y date-fns sí lanzaría, tumbando el render entero.
 */
function formatearFecha(iso: string): { absoluta: string; relativa: string } | null {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null

  return {
    absoluta: format(fecha, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es }),
    relativa: formatDistanceToNow(fecha, { addSuffix: true, locale: es }),
  }
}

export function ConnectCard({
  cuenta,
  error,
}: {
  cuenta: GmailAccount | null
  error?: string
}): ReactNode {
  const ultimoSync = cuenta?.last_sync_at ? formatearFecha(cuenta.last_sync_at) : null

  // Sin refresh_token el access_token vence en una hora y el sync muere en
  // silencio. Avisarlo acá evita que el usuario crea que está todo bien.
  const autorizacionIncompleta = cuenta !== null && cuenta.refresh_token === null

  return (
    <Card>
      <CardHeader
        eyebrow="Cuenta de origen"
        title="Conexión con Gmail"
        action={
          cuenta ? (
            <form action={desconectarCuenta}>
              <button
                type="submit"
                className="border border-rule px-3 py-1.5 text-xs text-paper-dim transition-colors hover:border-red/50 hover:text-red"
              >
                Desconectar
              </button>
            </form>
          ) : null
        }
      />

      <CardBody className="space-y-4">
        {error && (
          <p className="border border-red/40 bg-red/10 px-3 py-2 text-xs leading-relaxed text-red">
            {traducirError(error)}
          </p>
        )}

        {cuenta ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow mb-1">Conectada</p>
                <p className="tabular truncate text-sm text-paper" title={cuenta.email}>
                  {cuenta.email}
                </p>
              </div>
              <span
                className="mt-1 size-2 shrink-0 rounded-full bg-green"
                aria-hidden="true"
              />
            </div>

            <div className="rule-dotted h-px" />

            <div>
              <p className="eyebrow mb-1">Última sincronización</p>
              {ultimoSync ? (
                <p className="text-sm text-paper-dim">
                  <span className="tabular text-paper">{ultimoSync.absoluta}</span>
                  <span className="text-paper-faint"> · {ultimoSync.relativa}</span>
                </p>
              ) : (
                <p className="text-sm text-paper-faint">
                  Todavía no se corrió ninguna. Dale a &laquo;Sincronizar ahora&raquo;.
                </p>
              )}
            </div>

            {autorizacionIncompleta && (
              <p className="border border-dashed border-gold/40 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-paper-dim">
                <span className="text-gold">Autorización incompleta.</span> Google no
                dejó un permiso de larga duración, así que el sync deja de funcionar
                al cabo de una hora. Desconectá y volvé a conectar aceptando todos
                los permisos.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-paper-dim">
              Conectá el buzón donde llegan las notificaciones de Bancolombia. Se
              pide permiso de{' '}
              <span className="tabular text-gold">solo lectura</span>: la app lee
              esos correos para registrar los movimientos, y nunca escribe, responde
              ni borra nada.
            </p>

            <a
              href="/api/gmail/auth"
              className="inline-block bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
            >
              Conectar cuenta de Gmail
            </a>
          </>
        )}
      </CardBody>
    </Card>
  )
}
