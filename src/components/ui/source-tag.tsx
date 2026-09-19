import { cn } from '@/lib/cn'
import type { TransactionSource } from '@/lib/types'

/** Cada origen tiene su pastel fijo en toda la app: efectivo vainilla, Bancolombia lavanda. */
const SOURCES: Record<TransactionSource, { label: string; className: string }> = {
  manual: { label: 'Manual',      className: 'bg-rule-soft' },
  cash:   { label: 'Efectivo',    className: 'bg-vainilla/70' },
  gmail:  { label: 'Bancolombia', className: 'bg-lavanda/80' },
  import: { label: 'Importado',   className: 'bg-rule-soft' },
}

/** Marca de dónde salió una transacción. Los 3 módulos de datos lo usan. */
export function SourceTag({ source }: { source: TransactionSource }) {
  const s = SOURCES[source]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-carbon',
        s.className,
      )}
    >
      {s.label}
    </span>
  )
}
