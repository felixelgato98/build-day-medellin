import { cn } from '@/lib/cn'
import { formatCOP } from '@/lib/money'

type Tone = 'neutral' | 'income' | 'expense'

/** El tono pinta el fondo, no la cifra: la cifra siempre en carbón, legible. */
const TONE: Record<Tone, string> = {
  neutral: 'bg-superficie',
  income: 'bg-oliva/45',
  expense: 'bg-lavanda/60',
}

/**
 * Cifra grande y tabular para que varias tarjetas en fila alineen sus dígitos.
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
    <div className={cn('rounded-[24px] px-5 py-4', TONE[tone], className)}>
      <p className="text-sm text-paper-dim">{label}</p>
      <p className="headline tabular mt-2 text-3xl">{formatCOP(cents)}</p>
      {hint && <p className="mt-1 text-xs text-paper-dim">{hint}</p>}
    </div>
  )
}
