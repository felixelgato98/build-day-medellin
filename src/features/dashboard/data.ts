import 'server-only'
import { isSameDay, startOfDay, startOfMonth, subDays } from 'date-fns'
import { getTransactions, type CategoryTotal, type PeriodSummary } from '@/lib/queries'
import type { TransactionWithCategory } from '@/lib/types'
import { buildSampleTransactions } from './sample-data'

export interface DayTotal {
  date: Date
  expenseCents: number
  isToday: boolean
}

export interface HomeData {
  summary: PeriodSummary
  byCategory: CategoryTotal[]
  week: DayTotal[]
  recent: TransactionWithCategory[]
  /** true cuando Supabase no está configurado y se muestran datos de ejemplo. */
  isSample: boolean
}

/**
 * Todo lo que necesita el Home en UNA sola consulta: desde el inicio del mes
 * (o hace 7 días, lo que sea antes) y el resto se agrega en memoria.
 */
export async function getHomeData(now = new Date()): Promise<HomeData> {
  const monthStart = startOfMonth(now)
  const weekStart = startOfDay(subDays(now, 6))
  const from = monthStart < weekStart ? monthStart : weekStart

  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const rows = configured
    ? await getTransactions({ from: from.toISOString() })
    : buildSampleTransactions(now)

  const month = rows.filter((t) => new Date(t.occurred_at) >= monthStart)

  return {
    summary: summarize(month),
    byCategory: groupByCategory(month),
    week: lastSevenDays(rows, now),
    recent: rows.slice(0, 6),
    isSample: !configured,
  }
}

function summarize(rows: TransactionWithCategory[]): PeriodSummary {
  let incomeCents = 0
  let expenseCents = 0
  for (const t of rows) {
    if (t.kind === 'income') incomeCents += t.amount_cents
    else expenseCents += t.amount_cents
  }
  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    count: rows.length,
  }
}

function groupByCategory(rows: TransactionWithCategory[]): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>()
  for (const t of rows) {
    if (t.kind !== 'expense') continue
    const key = t.category?.id ?? 'sin-categoria'
    const existing = totals.get(key)
    if (existing) existing.totalCents += t.amount_cents
    else
      totals.set(key, {
        categoryId: t.category?.id ?? null,
        name: t.category?.name ?? 'Sin categoría',
        color: t.category?.color ?? null,
        icon: t.category?.icon ?? null,
        totalCents: t.amount_cents,
      })
  }
  return [...totals.values()].sort((a, b) => b.totalCents - a.totalCents)
}

function lastSevenDays(rows: TransactionWithCategory[], now: Date): DayTotal[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(now, 6 - i))
    const expenseCents = rows
      .filter((t) => t.kind === 'expense' && isSameDay(new Date(t.occurred_at), date))
      .reduce((sum, t) => sum + t.amount_cents, 0)
    return { date, expenseCents, isToday: i === 6 }
  })
}
