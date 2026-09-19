import { cn } from '@/lib/cn'
import { formatCOP } from '@/lib/money'

type Tone = 'neutral' | 'income' | 'expense'

const TONE: Record<Tone, string> = {
  neutral: 'text-paper',
  income: 'text-green',
  expense: 'text-red',
}

/**
 * La cifra es el héroe. Grande, monoespaciada y tabular para que varias
 * tarjetas en fila alineen sus dígitos como en un libro contable.
 */
export function StatCard({
  label,
  cents,
  tone = 'neutral',
  hint,
  className,
}: {
  label: string
  cents: number
  tone?: Tone
  hint?: string
  className?: string
}) {
  return (
    <div className={cn('border border-rule bg-ink-2/60 px-5 py-4', className)}>
      <p className="eyebrow">{label}</p>
      <p className={cn('tabular mt-2 text-3xl font-medium', TONE[tone])}>
        {formatCOP(cents)}
      </p>
      {hint && <p className="mt-1 text-xs text-paper-faint">{hint}</p>}
    </div>
  )
}
