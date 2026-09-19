import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCOP } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { DayTotal } from './data'
import { splitAmount } from './format'

/** Los últimos 7 días, uno por barra. Tarjeta vainilla, como el "sleep tracking" de la referencia. */
export function WeekCard({ days }: { days: DayTotal[] }) {
  const total = days.reduce((s, d) => s + d.expenseCents, 0)
  const max = Math.max(...days.map((d) => d.expenseCents), 1)
  const priciest = days.reduce((a, b) => (b.expenseCents > a.expenseCents ? b : a))
  const amount = splitAmount(total)

  return (
    <section
      aria-labelledby="week-title"
      className="rise rounded-[28px] bg-vainilla p-5"
      style={{ animationDelay: '120ms' }}
    >
      <div className="flex items-start justify-between">
        <h2 id="week-title" className="headline text-xl">
          Esta semana
        </h2>
        <span className="rounded-full bg-carbon px-3 py-1 text-xs text-crema">
          Últimos 7 días
        </span>
      </div>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="headline text-2xl">$</span>
        <span className="headline tabular text-6xl tracking-[-0.05em]">{amount.value}</span>
        <span className="headline text-lg">{amount.unit}</span>
        <span className="ml-1 text-sm text-carbon/70">gastados</span>
      </p>

      {/* ------------------------------ Barras ----------------------------- */}
      <ol className="mt-6 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const pct = (d.expenseCents / max) * 100
          const label = format(d.date, 'EEEEEE', { locale: es })
          return (
            <li key={d.date.toISOString()} className="flex flex-col items-center">
              <div
                className="flex h-28 w-full items-end justify-center"
                title={`${format(d.date, "EEEE d", { locale: es })}: ${formatCOP(d.expenseCents)}`}
              >
                {d.expenseCents > 0 ? (
                  <div
                    className={cn('w-3 rounded-full', d.isToday ? 'bg-chicle' : 'bg-carbon')}
                    style={{ height: `${Math.max(pct, 6)}%` }}
                  />
                ) : (
                  // Día sin gastos: un punto hueco, no una barra en cero.
                  <div className="size-3 rounded-full border-2 border-dashed border-carbon/40" />
                )}
              </div>
              <span
                className={cn(
                  'mt-2 grid size-8 place-items-center rounded-full text-[11px] uppercase',
                  d.isToday ? 'bg-carbon font-semibold text-crema' : 'text-carbon/70',
                )}
              >
                {label}
              </span>
              <span className="tabular mt-0.5 text-[11px] text-carbon/60">
                {format(d.date, 'd')}
              </span>
            </li>
          )
        })}
      </ol>

      {priciest.expenseCents > 0 && (
        <p className="mt-4 rounded-2xl bg-superficie/60 px-4 py-3 text-sm">
          El día más caro fue el{' '}
          <span className="font-medium">
            {format(priciest.date, "EEEE d", { locale: es })}
          </span>
          : <span className="tabular">{formatCOP(priciest.expenseCents)}</span>
        </p>
      )}
    </section>
  )
}
