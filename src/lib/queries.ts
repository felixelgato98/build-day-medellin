import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { WORKSPACE_ID } from '@/lib/constants'
import type {
  Category,
  TransactionKind,
  TransactionSource,
  TransactionWithCategory,
} from '@/lib/types'

/**
 * Queries compartidas de LECTURA. Base congelada.
 *
 * Existen para que Dashboard (módulo 1) y Chat IA (módulo 4) no dependan de que
 * el módulo de Transacciones (módulo 2) esté terminado. Todos leen de acá.
 *
 * Si necesitás una query nueva y genérica, agregala acá en un PR aparte y avisá
 * al equipo. Si es específica de tu módulo, va en tu propia carpeta features/.
 */

const SELECT_WITH_CATEGORY = `
  *,
  category:categories (id, name, icon, color)
`

export interface TransactionFilters {
  kind?: TransactionKind
  source?: TransactionSource
  categoryId?: string
  /** ISO date. Inclusive. */
  from?: string
  /** ISO date. Inclusive. */
  to?: string
  limit?: number
}

/** Transacciones del workspace, más recientes primero. */
export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionWithCategory[]> {
  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select(SELECT_WITH_CATEGORY)
    .eq('workspace_id', WORKSPACE_ID)
    .order('occurred_at', { ascending: false })

  if (filters.kind) query = query.eq('kind', filters.kind)
  if (filters.source) query = query.eq('source', filters.source)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.from) query = query.gte('occurred_at', filters.from)
  if (filters.to) query = query.lte('occurred_at', filters.to)
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw new Error(`No se pudieron leer las transacciones: ${error.message}`)

  return (data ?? []) as unknown as TransactionWithCategory[]
}

/** Categorías del workspace, opcionalmente filtradas por tipo. */
export async function getCategories(kind?: TransactionKind): Promise<Category[]> {
  const supabase = await createClient()

  let query = supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('name')

  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`)

  return data ?? []
}

export interface PeriodSummary {
  incomeCents: number
  expenseCents: number
  balanceCents: number
  count: number
}

/** Totales de ingresos/gastos en un rango. Todo en centavos. */
export async function getSummary(
  from?: string,
  to?: string,
): Promise<PeriodSummary> {
  const rows = await getTransactions({ from, to })

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

export interface CategoryTotal {
  categoryId: string | null
  name: string
  color: string | null
  icon: string | null
  totalCents: number
}

/** Gasto agrupado por categoría, de mayor a menor. Para la gráfica del dashboard. */
export async function getSpendByCategory(
  from?: string,
  to?: string,
): Promise<CategoryTotal[]> {
  const rows = await getTransactions({ kind: 'expense', from, to })
  const totals = new Map<string, CategoryTotal>()

  for (const t of rows) {
    const key = t.category?.id ?? 'sin-categoria'
    const existing = totals.get(key)

    if (existing) {
      existing.totalCents += t.amount_cents
    } else {
      totals.set(key, {
        categoryId: t.category?.id ?? null,
        name: t.category?.name ?? 'Sin categoría',
        color: t.category?.color ?? null,
        icon: t.category?.icon ?? null,
        totalCents: t.amount_cents,
      })
    }
  }

  return [...totals.values()].sort((a, b) => b.totalCents - a.totalCents)
}

/** Primer y último instante del mes actual, en ISO. Útil para los filtros. */
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Usuario autenticado, o null. */
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
