import { SourceTag } from '@/components/ui/source-tag'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCOP } from '@/lib/money'
import type { TransactionWithCategory } from '@/lib/types'

/** Lista de movimientos. Compartida: la usan Transacciones, Efectivo y Gmail. */
export function TransactionList({
  transactions,
  emptyTitle = 'Sin movimientos',
  emptyDescription = 'Todavía no hay nada acá.',
}: {
  transactions: TransactionWithCategory[]
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (transactions.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="border border-rule">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between gap-4 border-b border-rule-soft px-5 py-3.5 transition-colors last:border-0 hover:bg-ink-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-paper">{t.description}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <SourceTag source={t.source} />
              <span className="text-xs text-paper-faint">
                {t.category?.name ?? 'Sin categoría'}
              </span>
              {t.merchant && (
                <span className="text-xs text-paper-faint">· {t.merchant}</span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p
              className={`tabular text-sm ${
                t.kind === 'income' ? 'text-green' : 'text-red'
              }`}
            >
              {t.kind === 'income' ? '+' : '−'} {formatCOP(t.amount_cents)}
            </p>
            <p className="tabular mt-1 text-xs text-paper-faint">
              {new Date(t.occurred_at).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
