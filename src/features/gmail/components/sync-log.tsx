import { differenceInMilliseconds, format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/cn'
import type { GmailSyncLog } from '@/lib/types'

type Estado = 'en_curso' | 'error' | 'ok'

const ESTADO: Record<Estado, { label: string; className: string }> = {
  en_curso: { label: 'En curso', className: 'text-blue border-blue/40' },
  error: { label: 'Falló', className: 'text-red border-red/40' },
  ok: { label: 'Listo', className: 'text-green border-green/40' },
}

/**
 * Una corrida sin `finished_at` no terminó: puede estar corriendo ahora mismo o
 * haber muerto con el proceso. Mostrarla como "Listo" con 0 guardados haría
 * pensar que el buzón está vacío, que es justo el diagnóstico equivocado.
 */
function estadoDe(entrada: GmailSyncLog): Estado {
  if (entrada.error) return 'error'
  if (!entrada.finished_at) return 'en_curso'
  return 'ok'
}

/** Null en vez de "Invalid Date": una fila corrupta no puede tumbar la página. */
function aFecha(iso: string | null): Date | null {
  if (!iso) return null
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

function fechaRelativa(fecha: Date): string {
  return formatDistanceToNow(fecha, { addSuffix: true, locale: es })
}

function fechaAbsoluta(fecha: Date): string {
  return format(fecha, "d 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es })
}

/** Cuánto tardó la corrida. Con coma decimal, que es como se lee en Colombia. */
function duracionDe(inicio: Date, fin: Date): string | null {
  const ms = differenceInMilliseconds(fin, inicio)
  if (ms < 0) return null
  if (ms < 1000) return `${ms} ms`

  const segundos = ms / 1000
  if (segundos < 60) return `${segundos.toFixed(1).replace('.', ',')} s`

  const minutos = Math.floor(segundos / 60)
  return `${minutos} min ${Math.round(segundos % 60)} s`
}

function EstadoTag({ estado }: { estado: Estado }) {
  const e = ESTADO[estado]
  return (
    <span
      className={cn(
        'inline-flex items-center border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        e.className,
      )}
    >
      {e.label}
    </span>
  )
}

function Cifra({
  label,
  valor,
  destacar = false,
}: {
  label: string
  valor: number
  destacar?: boolean
}) {
  return (
    <div className="text-right">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          'tabular mt-1 text-sm',
          destacar ? 'text-gold' : 'text-paper-dim',
        )}
      >
        {valor}
      </dd>
    </div>
  )
}

/**
 * Bitácora de `gmail_sync_log`. Es la herramienta de diagnóstico del módulo:
 * "vistos" contra "guardados" explica solo si el parser se quedó corto o si
 * simplemente no llegaron correos nuevos.
 */
export function SyncLog({ entradas }: { entradas: GmailSyncLog[] }) {
  // Ordenamos acá para no depender de que cada caller recuerde el ORDER BY.
  const ordenadas = [...entradas].sort((a, b) =>
    b.started_at.localeCompare(a.started_at),
  )

  return (
    <Card>
      <CardHeader
        eyebrow="Bitácora"
        title="Historial de sincronizaciones"
        action={
          ordenadas.length > 0 ? (
            <span className="eyebrow">
              {ordenadas.length} {ordenadas.length === 1 ? 'corrida' : 'corridas'}
            </span>
          ) : undefined
        }
      />

      {ordenadas.length === 0 ? (
        <CardBody>
          <EmptyState
            title="Todavía no se ha sincronizado"
            description="Conectá la cuenta y dale a Sincronizar ahora. Cada corrida queda registrada acá con cuántos correos vio y cuántos guardó."
          />
        </CardBody>
      ) : (
        <ol>
          {ordenadas.map((entrada) => {
            const estado = estadoDe(entrada)
            const inicio = aFecha(entrada.started_at)
            const fin = aFecha(entrada.finished_at)
            const duracion = inicio && fin ? duracionDe(inicio, fin) : null

            return (
              <li
                key={entrada.id}
                className="border-b border-rule-soft px-5 py-3.5 transition-colors last:border-0 hover:bg-ink-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0">
                    {inicio ? (
                      <time
                        dateTime={entrada.started_at}
                        title={fechaAbsoluta(inicio)}
                        className="text-sm text-paper"
                      >
                        {fechaRelativa(inicio)}
                      </time>
                    ) : (
                      <span className="text-sm text-paper-faint">
                        Fecha desconocida
                      </span>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <EstadoTag estado={estado} />
                      {duracion && (
                        <span className="tabular text-xs text-paper-faint">
                          {duracion}
                        </span>
                      )}
                    </div>
                  </div>

                  <dl className="flex shrink-0 items-start gap-6">
                    <Cifra label="Vistos" valor={entrada.messages_seen} />
                    <Cifra
                      label="Guardados"
                      valor={entrada.messages_saved}
                      destacar={entrada.messages_saved > 0}
                    />
                  </dl>
                </div>

                {entrada.error && (
                  <p className="mt-3 border-l-2 border-red/50 bg-red/5 py-1.5 pl-3 text-xs leading-relaxed break-words text-red">
                    {entrada.error}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
