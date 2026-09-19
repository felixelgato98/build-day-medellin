'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { procesarCorreoPegado } from '../actions'

/**
 * Pegar un correo a mano.
 *
 * Cumple dos funciones que justifican su existencia aunque OAuth ya funcione:
 *
 *  1. Escape hatch: si Google Cloud se atasca (pantalla de verificación,
 *     scope sin aprobar, credenciales que no bajan), el módulo igual sirve
 *     — se copia el correo desde Gmail y el movimiento entra.
 *  2. Herramienta de debug: cuando un formato nuevo de Bancolombia no parsea,
 *     acá se ve el motivo en un segundo, sin correr un sync de 80 correos ni
 *     abrir la consola.
 *
 * Es `'use client'` porque necesita el estado de envío y mostrar la respuesta
 * sin recargar: pegar, leer el resultado, corregir y reintentar tiene que ser
 * un ciclo de dos segundos. El resto del módulo sigue en el servidor.
 */

/** Lo que devuelve la Server Action (ver CONTRACT.md). */
interface Respuesta {
  ok: boolean
  mensaje: string
}

interface EstadoPegado {
  respuesta: Respuesta | null
  /** Contador de envíos: sirve de `key` para re-animar el aviso en cada intento. */
  intento: number
}

const ESTADO_INICIAL: EstadoPegado = { respuesta: null, intento: 0 }

/**
 * Correo de ejemplo. No es decoración: al ver la forma exacta que el parser
 * espera, quien está depurando sabe de entrada si lo que va a pegar se le
 * parece o no.
 */
const EJEMPLO = [
  'Bancolombia le informa',
  'Compra por $45.000 en EXITO ENVIGADO el 19/09/2026 14:32.',
  'Para mayor información consulte su Sucursal Virtual Personas.',
].join('\n')

/**
 * Espejo de la tabla de formatos de CONTRACT.md. Se muestra plegado para que
 * un formato que no parsea se pueda comparar contra los cinco reconocidos sin
 * salir de la página. Si el parser aprende un formato nuevo, actualizá esto.
 */
const FORMATOS: ReadonlyArray<{ patron: string; efecto: 'ingreso' | 'gasto' }> = [
  { patron: 'Recepción de transferencia por $X de FULANO', efecto: 'ingreso' },
  { patron: 'Pago recibido por $X de FULANO', efecto: 'ingreso' },
  { patron: 'Compra por $X en COMERCIO', efecto: 'gasto' },
  { patron: 'Retiro por $X en CAJERO Y', efecto: 'gasto' },
  { patron: 'Transferencia por $X a FULANO', efecto: 'gasto' },
]

/**
 * La Server Action nunca lanza por un formato raro — devuelve `ok: false`.
 * Pero la llamada en sí sí puede fallar (red caída, deploy a mitad de camino),
 * y ese rechazo sube al error boundary y se lleva la página entera. Atraparlo
 * acá convierte una pantalla rota en una línea roja dentro del formulario.
 */
async function procesar(
  previo: EstadoPegado,
  formData: FormData,
): Promise<EstadoPegado> {
  try {
    const respuesta = await procesarCorreoPegado(previo.respuesta, formData)
    return { respuesta, intento: previo.intento + 1 }
  } catch (e) {
    return {
      respuesta: {
        ok: false,
        mensaje:
          e instanceof Error
            ? e.message
            : 'No pudimos contactar al servidor. Revisá la conexión y probá de nuevo.',
      },
      intento: previo.intento + 1,
    }
  }
}

export function PasteEmailForm() {
  const [estado, enviar, pendiente] = useActionState(procesar, ESTADO_INICIAL)

  // El texto es controlado a propósito: tras un envío React resetea el form,
  // y en la herramienta de debug perder lo pegado obliga a volver a Gmail.
  // Acá se queda en pantalla para ajustarlo y reintentar.
  const [texto, setTexto] = useState('')
  const [asunto, setAsunto] = useState('')

  const idTexto = useId()
  const idAsunto = useId()
  const idAyuda = useId()

  const vacio = texto.trim() === ''

  return (
    <Card>
      <CardHeader
        eyebrow="Escape hatch · debug"
        title="Pegar un correo a mano"
      />

      <CardBody className="space-y-5">
        <p className="max-w-prose text-sm text-paper-dim">
          Copiá el texto de un correo de Bancolombia y pegalo acá. Se parsea con
          el mismo lector que usa la sincronización, así que sirve para dos
          cosas: registrar un movimiento cuando el acceso a Gmail todavía no
          está listo, y ver por qué un formato nuevo no se está leyendo.
        </p>

        <form action={enviar} className="space-y-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <label htmlFor={idTexto} className="eyebrow">
                Texto del correo
              </label>
              <BotonTexto
                onClick={() => setTexto(EJEMPLO)}
                disabled={pendiente}
                label="Usar un ejemplo"
              />
            </div>

            <textarea
              id={idTexto}
              name="texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={7}
              spellCheck={false}
              aria-describedby={idAyuda}
              placeholder={EJEMPLO}
              className={cn(
                'block w-full resize-y border border-rule bg-ink/60 px-3.5 py-3',
                'font-mono text-sm leading-relaxed text-paper placeholder:text-paper-faint',
                'transition-colors focus:border-gold/60 focus:outline-none',
              )}
            />

            <p id={idAyuda} className="mt-2 text-xs text-paper-faint">
              Pegá el cuerpo completo, con el monto y el comercio tal como los
              escribe Bancolombia. Pegar dos veces el mismo correo no duplica el
              gasto: el movimiento se identifica por su contenido.
            </p>
          </div>

          <div>
            <label htmlFor={idAsunto} className="eyebrow mb-2 block">
              Asunto <span className="normal-case tracking-normal">(opcional)</span>
            </label>

            <input
              id={idAsunto}
              name="asunto"
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Bancolombia le informa"
              className={cn(
                'block w-full border border-rule bg-ink/60 px-3.5 py-2.5',
                'text-sm text-paper placeholder:text-paper-faint',
                'transition-colors focus:border-gold/60 focus:outline-none',
              )}
            />

            <p className="mt-2 text-xs text-paper-faint">
              Si lo dejás vacío se usa la primera línea del texto pegado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <BotonProcesar vacio={vacio} />

            <BotonTexto
              onClick={() => {
                setTexto('')
                setAsunto('')
              }}
              disabled={pendiente || (vacio && asunto === '')}
              label="Limpiar"
            />

            {texto.length > 0 && (
              <span className="tabular text-xs text-paper-faint">
                {texto.length} caracteres
              </span>
            )}
          </div>

          {/*
            El resultado aparece después de que el foco ya se movió: sin región
            viva, quien usa lector de pantalla no se entera de que se guardó.
          */}
          <div aria-live="polite" aria-busy={pendiente}>
            {estado.respuesta !== null && (
              <Aviso
                key={estado.intento}
                respuesta={estado.respuesta}
                atenuado={pendiente}
              />
            )}
          </div>
        </form>

        <Formatos />
      </CardBody>
    </Card>
  )
}

/**
 * Vive aparte del formulario porque `useFormStatus` sólo ve el `<form>` que
 * tiene por encima: llamado desde el componente que renderiza el form, siempre
 * devolvería `pending: false`.
 */
function BotonProcesar({ vacio }: { vacio: boolean }) {
  const { pending } = useFormStatus()
  const bloqueado = vacio || pending

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
      <Marca girando={pending} />
      {pending ? 'Leyendo…' : 'Procesar correo'}
    </button>
  )
}

/** Acción secundaria: texto subrayado, para que no compita con el botón real. */
function BotonTexto({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void
  disabled: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'text-xs underline underline-offset-4 transition-colors',
        disabled
          ? 'cursor-not-allowed text-paper-faint/50 no-underline'
          : 'text-paper-faint hover:text-paper',
      )}
    >
      {label}
    </button>
  )
}

/** Ícono en SVG inline: el kit no trae librería de íconos y no vamos a sumar una. */
function Marca({ girando }: { girando: boolean }) {
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
      {girando ? (
        <>
          <circle cx="8" cy="8" r="6.2" opacity={0.25} />
          <path d="M14.2 8A6.2 6.2 0 0 0 8 1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="2.4" y="2.4" width="11.2" height="11.2" opacity={0.45} />
          <path d="M5.2 6.4h5.6M5.2 9.2h3.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function Aviso({
  respuesta,
  atenuado,
}: {
  respuesta: Respuesta
  atenuado: boolean
}) {
  const { ok, mensaje } = respuesta

  return (
    <div
      className={cn(
        'rise border px-5 py-4 transition-opacity',
        ok ? 'border-green/40 bg-green/5' : 'border-red/40 bg-red/5',
        // Mientras corre el siguiente intento, lo de pantalla ya es historia.
        atenuado && 'opacity-40',
      )}
    >
      <p className={cn('eyebrow', ok ? 'text-green' : 'text-red')}>
        {ok ? 'Correo procesado' : 'No se pudo leer'}
      </p>
      <p className="mt-2 text-sm text-paper-dim">{mensaje}</p>

      {!ok && (
        <p className="mt-2 text-xs text-paper-faint">
          Si el correo es legítimo y aun así no entra, es un formato nuevo: el
          texto de arriba es exactamente lo que necesita el reconocedor que
          falta.
        </p>
      )}
    </div>
  )
}

function Formatos() {
  return (
    <details className="border-t border-rule pt-4">
      <summary className="cursor-pointer select-none text-sm text-paper-dim transition-colors hover:text-paper">
        ¿Qué formatos reconoce?
      </summary>

      <ul className="mt-3 space-y-2">
        {FORMATOS.map((formato) => (
          <li
            key={formato.patron}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-rule-soft pt-2 first:border-t-0 first:pt-0"
          >
            <code className="font-mono text-xs text-paper-dim">{formato.patron}</code>
            <span
              className={cn(
                'eyebrow',
                formato.efecto === 'ingreso' ? 'text-green' : 'text-red',
              )}
            >
              {formato.efecto}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-paper-faint">
        Los montos se leen en formato colombiano: <span className="tabular">$45.000</span>{' '}
        son cuarenta y cinco mil pesos, no cuarenta y cinco.
      </p>
    </details>
  )
}
