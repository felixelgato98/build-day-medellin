import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DbNotReady } from '@/components/ui/db-not-ready'
import { PageHeader } from '@/components/ui/page-header'
import { TransactionList } from '@/components/transaction-list'
import { ConnectCard } from '@/features/gmail/components/connect-card'
import { PasteEmailForm } from '@/features/gmail/components/paste-email-form'
import { SyncButton } from '@/features/gmail/components/sync-button'
import { SyncLog } from '@/features/gmail/components/sync-log'
import { WORKSPACE_ID } from '@/lib/constants'
import { getCurrentUser, getTransactions } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import type {
  GmailAccount,
  GmailSyncLog,
  TransactionWithCategory,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Corridas que se muestran en el historial. Más atrás ya es arqueología. */
const MAX_CORRIDAS = 10

/** Tope de movimientos listados, igual que en el resto de las páginas. */
const MAX_MOVIMIENTOS = 100

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface DatosDeLaPagina {
  cuenta: GmailAccount | null
  corridas: GmailSyncLog[]
  transacciones: TransactionWithCategory[]
}

/**
 * Traducción de los `?error=` que deja el callback de OAuth.
 *
 * Por la URL sólo puede viajar un código corto: la ruta redirige antes de poder
 * renderizar nada. La frase que lee el humano se arma acá, del lado de la UI.
 */
const MENSAJES_DE_ERROR: Record<string, string> = {
  config:
    'Faltan las credenciales de Google en el servidor: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.',
  oauth_denegado: 'Cancelaste el permiso en la pantalla de Google. No se conectó nada.',
  oauth_google: 'Google canceló la autorización. Volvé a intentar en un minuto.',
  state_invalido:
    'La autorización no coincidió con la que iniciaste desde acá y se canceló por seguridad. Volvé a intentar sin abrir el enlace en otra pestaña.',
  sin_codigo: 'Google no devolvió el código de autorización. Volvé a intentar.',
  sin_supabase:
    'La base de datos todavía no está configurada, así que no hay dónde guardar la cuenta.',
  sin_sesion: 'Tenés que iniciar sesión en la app antes de conectar Gmail.',
  token_google: 'Google rechazó el intercambio de tokens. Volvé a conectar la cuenta.',
  sin_permiso_gmail:
    'Autorizaste la cuenta pero quedó sin el permiso de lectura de Gmail, así que no se puede leer un solo correo. Volvé a conectar aceptando todos los permisos.',
  correo_google: 'No se pudo leer el correo de la cuenta autorizada. Volvé a intentar.',
  sin_refresh_token:
    'Google no envió el permiso de larga duración, así que el sync dejaría de funcionar en una hora. Volvé a autorizar aceptando todos los permisos.',
  no_guardado:
    'La cuenta se autorizó pero no se pudo guardar. Revisá la conexión con Supabase.',
}

/** Un mismo parámetro puede venir repetido en la URL; vale el primero. */
function primerValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

function traducirError(codigo: string | undefined): string | undefined {
  if (!codigo) return undefined

  // Un código desconocido igual se muestra: esconderlo dejaría al usuario
  // mirando una pantalla que no cambió, sin saber que algo falló.
  return (
    MENSAJES_DE_ERROR[codigo] ??
    `No se pudo conectar la cuenta (${codigo}). Volvé a intentar.`
  )
}

async function leerCuenta(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<GmailAccount | null> {
  const { data, error } = await supabase
    .from('gmail_accounts')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo leer la cuenta conectada: ${error.message}`)
  }

  return data
}

async function leerCorridas(supabase: SupabaseServerClient): Promise<GmailSyncLog[]> {
  const { data, error } = await supabase
    .from('gmail_sync_log')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('started_at', { ascending: false })
    .limit(MAX_CORRIDAS)

  if (error) {
    throw new Error(`No se pudo leer el historial de sincronizaciones: ${error.message}`)
  }

  return data ?? []
}

async function cargarDatos(): Promise<DatosDeLaPagina> {
  // El entorno se lee acá adentro y nunca al importar el módulo: arriba,
  // `npm run build` reventaría en cualquier runner sin .env.local.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error('Supabase no está configurado. Corré: vercel env pull .env.local')
  }

  const usuario = await getCurrentUser()
  const supabase = await createClient()

  const [cuenta, corridas, transacciones] = await Promise.all([
    // La cuenta cuelga del usuario logueado; el log y los movimientos son del
    // workspace, así que se muestran aunque todavía no haya sesión.
    usuario ? leerCuenta(supabase, usuario.id) : null,
    leerCorridas(supabase),
    getTransactions({ source: 'gmail', limit: MAX_MOVIMIENTOS }),
  ])

  return { cuenta, corridas, transacciones }
}

export default async function GmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const errorDeOAuth = traducirError(primerValor(params.error))

  let datos: DatosDeLaPagina
  try {
    datos = await cargarDatos()
  } catch (e) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <Encabezado />
        <DbNotReady detail={e instanceof Error ? e.message : 'Error desconocido'} />
      </div>
    )
  }

  const { cuenta, corridas, transacciones } = datos
  const ultimaCorrida = corridas[0] ?? null

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Encabezado />

      <ConnectCard cuenta={cuenta} error={errorDeOAuth} />

      {/* Sin cuenta conectada no hay buzón que leer, pero la página sigue
          sirviendo: el formulario de abajo parsea un correo pegado a mano. */}
      <SyncButton disabled={cuenta === null} />

      {ultimaCorrida && <ResumenDeCorrida corrida={ultimaCorrida} />}

      <PasteEmailForm />

      <SyncLog entradas={corridas} />

      <section className="space-y-3">
        <p className="eyebrow">Movimientos con origen Gmail · {transacciones.length}</p>
        <TransactionList
          transactions={transacciones}
          emptyTitle="Sin movimientos de Gmail"
          emptyDescription="Cuando conectes la cuenta y corra el primer sync, aparecen acá."
        />
      </section>
    </div>
  )
}

function Encabezado() {
  return <PageHeader eyebrow="Ingesta automática" title="Gmail · Bancolombia" />
}

/**
 * Resumen de la última corrida tal como quedó guardada.
 *
 * El botón de sincronizar muestra el resultado de la corrida que vos disparaste;
 * esto muestra la última que existió, aunque la haya corrido el cron o tu socio
 * desde otro navegador.
 */
function ResumenDeCorrida({ corrida }: { corrida: GmailSyncLog }) {
  const enCurso = corrida.finished_at === null
  const cuando = formatearFechaHora(corrida.started_at)

  return (
    <Card>
      <CardHeader
        eyebrow="Registrado en el log"
        title="Último sync"
        action={
          <span className="tabular shrink-0 text-xs text-paper-faint">
            {cuando ?? 'Fecha desconocida'}
          </span>
        }
      />

      <CardBody className="p-0">
        <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3">
          <Cifra label="Correos vistos" valor={String(corrida.messages_seen)} />
          <Cifra
            label="Movimientos guardados"
            valor={String(corrida.messages_saved)}
            destacada={corrida.messages_saved > 0}
          />
          <Cifra
            label={enCurso ? 'Estado' : 'Duración'}
            valor={enCurso ? 'En curso' : (duracion(corrida) ?? '—')}
            hint={enCurso ? 'Todavía no cerró en el log.' : undefined}
          />
        </div>
      </CardBody>

      {corrida.error !== null && (
        <p className="border-t border-rule px-5 py-3 text-sm leading-relaxed text-red">
          {corrida.error}
        </p>
      )}
    </Card>
  )
}

function Cifra({
  label,
  valor,
  hint,
  destacada = false,
}: {
  label: string
  valor: string
  hint?: string
  destacada?: boolean
}) {
  return (
    <div className="bg-ink-2/60 px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p
        className={`tabular mt-1.5 text-2xl font-medium ${
          destacada ? 'text-green' : 'text-paper'
        }`}
      >
        {valor}
      </p>
      {hint && <p className="mt-1 text-xs text-paper-faint">{hint}</p>}
    </div>
  )
}

/**
 * Una fecha guardada puede venir corrupta: `new Date` no lanza, se queda en
 * Invalid Date y recién al formatear tumbaría el render de toda la página.
 */
function formatearFechaHora(iso: string): string | null {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null

  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function duracion(corrida: GmailSyncLog): string | null {
  if (corrida.finished_at === null) return null

  const inicio = new Date(corrida.started_at).getTime()
  const fin = new Date(corrida.finished_at).getTime()
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return null

  const segundos = Math.max(0, Math.round((fin - inicio) / 1000))
  if (segundos < 60) return `${segundos} s`

  return `${Math.floor(segundos / 60)} m ${segundos % 60} s`
}
