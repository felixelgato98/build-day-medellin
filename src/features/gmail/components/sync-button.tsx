'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { cn } from '@/lib/cn'
import { sincronizarAhora } from '../actions'
import type { SyncResult, UnparsedEmail } from '../types'

/**
 * Botón "Sincronizar ahora" + resumen de la última corrida.
 *
 * Es `'use client'` por una sola razón: necesita estado de carga y mostrar el
 * `SyncResult` que devuelve la Server Action sin recargar la página. Todo lo
 * demás del módulo sigue siendo Server Component.
 */

interface EstadoSync {
  resultado: SyncResult | null
  /** Fallo que impidió siquiera obtener un SyncResult (token muerto, red caída). */
  fallo: string | null
  /** Contador de corridas: sirve de `key` para re-animar el resumen cada vez. */
  corrida: number
}

const ESTADO_INICIAL: EstadoSync = { resultado: null, fallo: null, corrida: 0 }

/** Cuántos correos sin parsear se listan antes de resumir el resto en una línea. */
const MAX_NO_PARSEADOS_VISIBLES = 5

/**
 * `sincronizarAhora()` no recibe argumentos (ver CONTRACT.md), así que el
 * reducer ignora el FormData y sólo traduce resultado o excepción a algo
 * pintable.
 *
 * El `try` es deliberado: si la promesa se rechaza, React sube el error al
 * error boundary y el usuario pierde la página entera porque se venció un
 * refresh_token. Un sync fallido es información, no una pantalla rota.
 */
async function correrSync(previo: EstadoSync): Promise<EstadoSync> {
  try {
    const resultado = await sincronizarAhora()
    return { resultado, fallo: null, corrida: previo.corrida + 1 }
  } catch (e) {
    return {
      resultado: null,
      fallo:
        e instanceof Error
          ? e.message
          : 'No se pudo completar la sincronización. Probá de nuevo en un minuto.',
      corrida: previo.corrida + 1,
    }
  }
}

export function SyncButton({ disabled = false }: { disabled?: boolean }) {
  const [estado, sincronizar, pendiente] = useActionState(correrSync, ESTADO_INICIAL)

  return (
    <form action={sincronizar} className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BotonSincronizar disabled={disabled} />

        <p className="text-xs text-paper-faint">
          {disabled
            ? 'Conectá una cuenta de Gmail para poder sincronizar.'
            : 'Lee los correos de Bancolombia y los escribe como movimientos. Repetirlo no duplica nada.'}
        </p>
      </div>

      {/*
        Región viva: el resultado llega después de que el foco ya se movió, así
        que un lector de pantalla no se enteraría si no se lo anunciamos.
      */}
      <div aria-live="polite" aria-busy={pendiente}>
        {estado.fallo !== null && <AvisoFallo mensaje={estado.fallo} />}

        {estado.resultado !== null && (
          <Resumen
            key={estado.corrida}
            resultado={estado.resultado}
            atenuado={pendiente}
          />
        )}
      </div>
    </form>
  )
}

/**
 * Vive aparte del formulario porque `useFormStatus` sólo ve el `<form>` que
 * tiene por encima: llamado desde el mismo componente que renderiza el form,
 * siempre devolvería `pending: false`.
 */
function BotonSincronizar({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  const bloqueado = disabled || pending

  return (
    <button
      type="submit"
      disabled={bloqueado}
      className={cn(
        'inline-flex items-center gap-2.5 border px-4 py-2.5 text-sm font-medium transition-colors',
        bloqueado
          ? 'cursor-not-allowed border-rule text-paper-faint'
          : 'border-gold/50 text-gold hover:bg-gold hover:text-ink',
      )}
    >
      <Rueda girando={pending} />
      {pending ? 'Sincronizando…' : 'Sincronizar ahora'}
    </button>
  )
}

/** Indicador de carga en SVG inline: el kit no usa librería de íconos. */
function Rueda({ girando }: { girando: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className={cn('shrink-0', girando && 'animate-spin')}
    >
      <circle cx="8" cy="8" r="6.2" opacity={girando ? 0.25 : 0.45} />
      {girando ? (
        <path d="M14.2 8A6.2 6.2 0 0 0 8 1.8" strokeLinecap="round" />
      ) : (
        <path d="M8 4.4V8l2.6 1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

function AvisoFallo({ mensaje }: { mensaje: string }) {
  return (
    <div className="rise border border-red/40 bg-red/5 px-5 py-4">
      <p className="eyebrow text-red">La sincronización falló</p>
      <p className="mt-2 text-sm text-paper-dim">{mensaje}</p>
    </div>
  )
}

function Resumen({
  resultado,
  atenuado,
}: {
  resultado: SyncResult
  atenuado: boolean
}) {
  const { messagesSeen, messagesSaved, duplicados, noParseados, error } = resultado

  return (
    <div
      className={cn(
        'rise border border-rule bg-ink-2/60 transition-opacity',
        // Mientras corre la siguiente, lo de pantalla ya es historia: atenuarlo
        // evita que alguien lea cifras viejas como si fueran las nuevas.
        atenuado && 'opacity-40',
      )}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-3">
        <p className="eyebrow">Última corrida</p>
        <p className="text-xs text-paper-faint">
          {messagesSaved > 0
            ? `${messagesSaved} ${plural(messagesSaved, 'movimiento nuevo', 'movimientos nuevos')}`
            : 'Sin movimientos nuevos'}
        </p>
      </div>

      <dl className="grid grid-cols-2 divide-rule sm:grid-cols-4 sm:divide-x">
        <Cifra label="Vistos" valor={messagesSeen} />
        <Cifra label="Guardados" valor={messagesSaved} tono="ok" />
        <Cifra
          label="Duplicados"
          valor={duplicados}
          hint="Ya estaban. Es la idempotencia funcionando."
        />
        <Cifra
          label="No parseados"
          valor={noParseados.length}
          tono={noParseados.length > 0 ? 'atencion' : 'neutro'}
        />
      </dl>

      {error !== null && (
        <p className="border-t border-rule px-5 py-3 text-sm text-red">{error}</p>
      )}

      {noParseados.length > 0 && <ListaNoParseados correos={noParseados} />}
    </div>
  )
}

function Cifra({
  label,
  valor,
  tono = 'neutro',
  hint,
}: {
  label: string
  valor: number
  tono?: 'neutro' | 'ok' | 'atencion'
  hint?: string
}) {
  const color =
    tono === 'ok' && valor > 0
      ? 'text-green'
      : tono === 'atencion'
        ? 'text-gold'
        : 'text-paper'

  return (
    <div className="border-b border-rule px-5 py-4 last:border-b-0 sm:border-b-0">
      <dt className="eyebrow">{label}</dt>
      <dd className={cn('tabular mt-1.5 text-2xl font-medium', color)}>{valor}</dd>
      {hint && <p className="mt-1 text-xs text-paper-faint">{hint}</p>}
    </div>
  )
}

/**
 * Los correos que nadie supo leer no son un error: son el formato siguiente
 * que hay que soportar. Se muestran con asunto y motivo para que el reconocedor
 * se pueda escribir sin abrir Gmail.
 */
function ListaNoParseados({ correos }: { correos: UnparsedEmail[] }) {
  const visibles = correos.slice(0, MAX_NO_PARSEADOS_VISIBLES)
  const resto = correos.length - visibles.length

  return (
    <details className="border-t border-rule">
      <summary className="cursor-pointer select-none px-5 py-3 text-sm text-paper-dim transition-colors hover:text-paper">
        Ver {correos.length}{' '}
        {plural(correos.length, 'correo que no se pudo leer', 'correos que no se pudieron leer')}
      </summary>

      <ul className="px-5 pb-4">
        {visibles.map((correo) => (
          <li key={correo.id} className="border-t border-rule-soft py-3 first:border-t-0">
            <p className="truncate text-sm text-paper">{correo.subject}</p>
            <p className="mt-1 text-xs text-paper-faint">{correo.motivo}</p>
          </li>
        ))}

        {resto > 0 && (
          <li className="border-t border-rule-soft pt-3 text-xs text-paper-faint">
            y {resto} {plural(resto, 'más', 'más')}
          </li>
        )}
      </ul>
    </details>
  )
}

/** El resumen cambia de cifras en cada corrida; el texto tiene que seguirlas. */
function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? uno : varios
}
