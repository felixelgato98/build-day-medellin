import { cn } from '@/lib/cn'
import type { TransactionSource } from '@/lib/types'

const SOURCES: Record<TransactionSource, { label: string; className: string }> = {
  manual: { label: 'Manual',     className: 'text-paper-dim border-rule' },
  cash:   { label: 'Efectivo',   className: 'text-gold border-gold/40' },
  gmail:  { label: 'Bancolombia',className: 'text-blue border-blue/40' },
  import: { label: 'Importado',  className: 'text-paper-dim border-rule' },
}

/** Marca de dónde salió una transacción. Los 3 módulos de datos lo usan. */
export function SourceTag({ source }: { source: TransactionSource }) {
  const s = SOURCES[source]
  return (
    <span
      className={cn(
        'inline-flex items-center border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        s.className,
      )}
    >
      {s.label}
    </span>
  )
}
