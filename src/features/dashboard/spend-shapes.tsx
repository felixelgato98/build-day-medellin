import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCOP } from '@/lib/money'
import type { CategoryTotal } from '@/lib/queries'
import { cn } from '@/lib/cn'
import { splitAmount } from './format'
import { Shape, type ShapeName } from './shapes'

/**
 * La firma visual del Home: cada categoría de gasto es una forma y su TAMAÑO
 * es proporcional a lo gastado (área ∝ plata, por eso la raíz cuadrada).
 * Las posiciones son fijas por puesto para que la composición siempre
 * respire; lo que cambia con los datos es el tamaño.
 */

interface Slot {
  shape: ShapeName
  color: string
  /** Centro, en fracción del ANCHO del contenedor (x e y). */
  x: number
  y: number
  rotate: number
}

// Puesto 1 = la categoría más cara. Colores sin repetir entre vecinas.
const SLOTS: Slot[] = [
  { shape: 'star',   color: 'text-lavanda', x: 0.62, y: 0.60, rotate: 8 },
  { shape: 'flower', color: 'text-oliva',   x: 0.27, y: 0.27, rotate: 0 },
  { shape: 'heart',  color: 'text-chicle',  x: 0.25, y: 0.82, rotate: -8 },
  { shape: 'plus',   color: 'text-vainilla', x: 0.76, y: 0.18, rotate: 12 },
  { shape: 'drop',   color: 'text-oliva',   x: 0.83, y: 1.00, rotate: 24 },
]

/** Diámetro máximo (fracción del ancho) que puede tener la categoría más cara. */
const MAX = 0.5
/** Altura del lienzo en fracciones del ancho: deja lugar a la gota de abajo. */
const HEIGHT = 1.15

export function SpendShapes({
  categories,
  totalExpenseCents,
  monthLabel,
}: {
  categories: CategoryTotal[]
  totalExpenseCents: number
  monthLabel: string
}) {
  const top = categories.slice(0, SLOTS.length)
  const rest = categories.length - top.length
  const max = top[0]?.totalCents ?? 1

  return (
    <section aria-labelledby="spend-shapes-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="spend-shapes-title" className="headline text-2xl">
            En qué se fue la plata
          </h2>
          <p className="mt-1 text-sm text-paper-dim">
            Gastos de {monthLabel}, por categoría. Más grande, más plata.
          </p>
        </div>
        <Link
          href="/transacciones"
          className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-superficie"
        >
          Ver todo <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {top.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title={`Todavía no hay gastos en ${monthLabel}`}
            description="Cuando registres el primero, aparece acá con su forma y su tamaño."
          />
        </div>
      ) : (
        <>
          <ul
            className="@container relative mt-4 w-full"
            style={{ aspectRatio: `1 / ${HEIGHT}` }}
          >
            {top.map((c, i) => {
              const slot = SLOTS[i]
              // Mezcla: el 40% del tamaño es fijo para que el texto siempre
              // entre, el 60% sigue a la plata.
              const size = MAX * (0.4 + 0.6 * Math.sqrt(c.totalCents / max))
              const share = totalExpenseCents > 0 ? c.totalCents / totalExpenseCents : 0
              const amount = splitAmount(c.totalCents)

              return (
                <li
                  key={c.categoryId ?? c.name}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${slot.x * 100}%`,
                    top: `${(slot.y / HEIGHT) * 100}%`,
                    width: `${size * 100}%`,
                    zIndex: SLOTS.length - i,
                  }}
                >
                  <div
                    className="pop group relative aspect-square"
                    style={{ animationDelay: `${150 + i * 90}ms` }}
                    title={`${c.name}: ${formatCOP(c.totalCents)} (${Math.round(share * 100)}% del gasto)`}
                  >
                    <Shape
                      name={slot.shape}
                      className={cn(
                        'absolute inset-0 size-full transition-transform duration-500 group-hover:scale-105',
                        slot.color,
                      )}
                    />
                    <div
                      className="absolute inset-0 grid place-content-center text-center"
                      style={{ fontSize: `max(11px, ${size * 7.5}cqw)` }}
                    >
                      <span className="headline text-[1.25em] leading-tight">
                        {c.name}
                      </span>
                      <span className="tabular mt-0.5 text-[0.95em] text-carbon/70">
                        ${amount.value} {amount.unit}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {rest > 0 && (
            <p className="mt-2 text-sm text-paper-dim">
              +{rest} {rest === 1 ? 'categoría más' : 'categorías más'} con montos menores.
            </p>
          )}
        </>
      )}
    </section>
  )
}
