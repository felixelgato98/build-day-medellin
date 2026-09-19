import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { SourceTag } from '@/components/ui/source-tag'
import { formatCOP } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { TransactionSource, TransactionWithCategory } from '@/lib/types'
import { CategoryIcon } from './category-icon'

/** El círculo del ícono lleva el pastel del origen; los ingresos, siempre oliva. */
const SOURCE_TINT: Record<TransactionSource, string> = {
  cash: 'bg-vainilla',
  gmail: 'bg-lavanda',
  manual: 'bg-rule-soft',
  import: 'bg-rule-soft',
}

function when(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return 'Hoy'
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'd MMM', { locale: es })
}

export function RecentList({ transactions }: { transactions: TransactionWithCategory[] }) {
  return (
    <section
      aria-labelledby="recent-title"
      className="rise rounded-[28px] bg-superficie p-2"
      style={{ animationDelay: '200ms' }}
    >
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 id="recent-title" className="headline text-xl">
          Últimos movimientos
        </h2>
        <Link
          href="/transacciones"
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-crema"
        >
          Ver todo <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <p className="px-3 pb-4 text-sm text-paper-dim">
          Todavía no hay movimientos. Usá el botón + para agregar el primero.
        </p>
      ) : (
        <ul>
          {transactions.map((t) => {
            const income = t.kind === 'income'
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-[20px] px-3 py-2.5 transition-colors hover:bg-crema"
              >
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    income ? 'bg-oliva' : SOURCE_TINT[t.source],
                  )}
                >
                  <CategoryIcon name={t.category?.icon ?? null} className="size-[18px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.description}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-paper-dim">
                    <SourceTag source={t.source} />
                    <span className="truncate">
                      {t.category?.name ?? 'Sin categoría'} · {when(t.occurred_at)}
                    </span>
                  </div>
                </div>

                <span
                  className={cn(
                    'tabular shrink-0 text-sm font-medium',
                    income && 'text-green',
                  )}
                >
                  {income ? '+' : '−'} {formatCOP(t.amount_cents)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
