import { tool } from 'ai'
import { z } from 'zod'
import type { TransactionKind, TransactionSource } from '@/lib/types'
import type { CategoryTotal, PeriodSummary, TransactionFilters } from '@/lib/queries'
import {
  canDeleteFromChat,
  normalizeRange,
  pesosToCents,
  resolveCategory,
  type CategoryLike,
} from './logic'

/**
 * Tools del chat IA. Reciben sus dependencias (queries, escritura, reloj)
 * inyectadas para poder probarlas sin Supabase. La ruta API las conecta con
 * las funciones reales en `src/app/api/chat/route.ts`.
 *
 * Convención de resultados: éxito devuelve datos; fallo devuelve `{ error }`.
 * Nunca lanzan: el modelo necesita leer el error para explicárselo al usuario.
 */

/** Lo mínimo que las tools necesitan de una transacción. */
export interface TxRow {
  id: string
  kind: TransactionKind
  amount_cents: number
  description: string
  merchant: string | null
  occurred_at: string
  source: TransactionSource
  created_at: string
  category: { id: string; name: string } | null
}

export interface NewTx {
  kind: TransactionKind
  amount_cents: number
  description: string
  category_id: string
  occurred_at: string
  merchant: string | null
  source: 'manual'
}

export interface ChatToolDeps {
  now?: () => Date
  getCategories: (kind?: TransactionKind) => Promise<CategoryLike[]>
  getTransactions: (filters: TransactionFilters) => Promise<TxRow[]>
  getSummary: (from: string, to: string) => Promise<PeriodSummary>
  getSpendByCategory: (from: string, to: string) => Promise<CategoryTotal[]>
  getTransactionById: (id: string) => Promise<TxRow | null>
  insertTransaction: (input: NewTx) => Promise<TxRow>
  deleteTransaction: (id: string) => Promise<void>
}

const MAX_RESULTS = 50

const kindSchema = z.enum(['income', 'expense'])

const rangeSchema = {
  desde: z.string().optional().describe('Fecha inicial YYYY-MM-DD. Sin fechas: el mes en curso.'),
  hasta: z.string().optional().describe('Fecha final YYYY-MM-DD, inclusive.'),
}

function toPesos(cents: number): number {
  return cents / 100
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function present(t: TxRow) {
  return {
    id: t.id,
    tipo: t.kind,
    monto_pesos: toPesos(t.amount_cents),
    descripcion: t.description,
    comercio: t.merchant,
    categoria: t.category?.name ?? null,
    fecha: dateOnly(t.occurred_at),
    origen: t.source,
  }
}

function errorOf(err: unknown): { error: string } {
  const message = err instanceof Error ? err.message : String(err)
  return { error: `Falló la consulta a la base de datos: ${message}` }
}

/** Envuelve un execute para que cualquier excepción vuelva como `{ error }`. */
function safe<I, O>(fn: (input: I) => Promise<O>) {
  return async (input: I): Promise<O | { error: string }> => {
    try {
      return await fn(input)
    } catch (err) {
      return errorOf(err)
    }
  }
}

export function createChatTools(deps: ChatToolDeps) {
  const now = deps.now ?? (() => new Date())

  return {
    listar_categorias: tool({
      description:
        'Lista las categorías disponibles con su tipo (income o expense). Usala antes de filtrar o registrar por categoría si no estás seguro del nombre.',
      inputSchema: z.object({}),
      execute: safe(async () => {
        const cats = await deps.getCategories()
        return {
          categorias: cats.map((c) => ({ id: c.id, nombre: c.name, tipo: c.kind })),
        }
      }),
    }),

    buscar_transacciones: tool({
      description:
        'Busca movimientos del hogar. Filtra por categoría (nombre), tipo, origen, texto en descripción o comercio, y rango de fechas. Devuelve máximo 50, más recientes primero.',
      inputSchema: z.object({
        categoria: z.string().optional().describe('Nombre de la categoría, por ejemplo "Mercado".'),
        tipo: kindSchema.optional(),
        origen: z.enum(['manual', 'cash', 'gmail', 'import']).optional(),
        texto: z.string().optional().describe('Texto a buscar en descripción o comercio.'),
        ...rangeSchema,
        limite: z.number().int().positive().optional().describe('Máximo de resultados, tope 50.'),
      }),
      execute: safe(async (input) => {
        const filters: TransactionFilters = {
          kind: input.tipo,
          source: input.origen,
          limit: Math.min(input.limite ?? MAX_RESULTS, MAX_RESULTS),
        }

        if (input.categoria) {
          const cats = await deps.getCategories()
          const resolved = resolveCategory(cats, input.categoria, input.tipo)
          if (!resolved.ok) return { error: resolved.error }
          filters.categoryId = resolved.category.id
        }

        if (input.desde || input.hasta) {
          const range = normalizeRange(input, now())
          if (!range.ok) return { error: range.error }
          filters.from = range.from
          filters.to = range.to
        }

        let rows = await deps.getTransactions(filters)

        if (input.texto) {
          const needle = input.texto.trim().toLowerCase()
          rows = rows.filter(
            (r) =>
              r.description.toLowerCase().includes(needle) ||
              (r.merchant ?? '').toLowerCase().includes(needle),
          )
        }

        return { total: rows.length, movimientos: rows.map(present) }
      }),
    }),

    resumen_periodo: tool({
      description:
        'Ingresos, gastos, balance y cantidad de movimientos en un rango. Sin fechas usa el mes en curso. Para comparar meses, llamala una vez por mes.',
      inputSchema: z.object(rangeSchema),
      execute: safe(async (input) => {
        const range = normalizeRange(input, now())
        if (!range.ok) return { error: range.error }
        const s = await deps.getSummary(range.from, range.to)
        return {
          desde: dateOnly(range.from),
          hasta: dateOnly(range.to),
          ingresos_pesos: toPesos(s.incomeCents),
          gastos_pesos: toPesos(s.expenseCents),
          balance_pesos: toPesos(s.balanceCents),
          movimientos: s.count,
        }
      }),
    }),

    gasto_por_categoria: tool({
      description:
        'Gasto total por categoría en un rango, de mayor a menor. Ideal para "¿en qué se me fue la plata?". Sin fechas usa el mes en curso.',
      inputSchema: z.object(rangeSchema),
      execute: safe(async (input) => {
        const range = normalizeRange(input, now())
        if (!range.ok) return { error: range.error }
        const rows = await deps.getSpendByCategory(range.from, range.to)
        return {
          desde: dateOnly(range.from),
          hasta: dateOnly(range.to),
          categorias: rows.map((c) => ({ categoria: c.name, total_pesos: toPesos(c.totalCents) })),
        }
      }),
    }),

    registrar_movimiento: tool({
      description:
        'Registra un ingreso o gasto. SOLO llamala después de que el usuario confirme explícitamente monto, categoría, descripción y fecha. El monto va en pesos colombianos.',
      inputSchema: z.object({
        tipo: kindSchema,
        monto_pesos: z.number().describe('Monto en pesos, por ejemplo 45000.'),
        descripcion: z.string().min(1),
        categoria: z.string().describe('Nombre de una categoría existente del tipo indicado.'),
        fecha: z.string().optional().describe('YYYY-MM-DD. Sin fecha: hoy.'),
        comercio: z.string().optional(),
      }),
      execute: safe(async (input) => {
        const cents = pesosToCents(input.monto_pesos)
        if (cents === null) return { error: 'El monto debe ser un número mayor que cero, en pesos.' }

        const cats = await deps.getCategories(input.tipo)
        const resolved = resolveCategory(cats, input.categoria, input.tipo)
        if (!resolved.ok) return { error: resolved.error }

        let occurredAt = now().toISOString()
        if (input.fecha) {
          const range = normalizeRange({ desde: input.fecha }, now())
          if (!range.ok) return { error: range.error }
          occurredAt = range.from
        }

        const saved = await deps.insertTransaction({
          kind: input.tipo,
          amount_cents: cents,
          description: input.descripcion.trim(),
          category_id: resolved.category.id,
          occurred_at: occurredAt,
          merchant: input.comercio?.trim() || null,
          source: 'manual',
        })

        return { registrado: true, movimiento: present(saved) }
      }),
    }),

    eliminar_movimiento: tool({
      description:
        'Borra un movimiento por id. Solo funciona con movimientos manuales creados en las últimas 24 horas: sirve para deshacer un registro equivocado. Confirmá con el usuario antes.',
      inputSchema: z.object({ id: z.string().min(1) }),
      execute: safe(async (input) => {
        const existing = await deps.getTransactionById(input.id)
        if (!existing) return { error: `No existe un movimiento con id ${input.id}.` }

        const check = canDeleteFromChat(existing, now())
        if (!check.ok) return { error: check.error }

        await deps.deleteTransaction(existing.id)
        return {
          eliminado: true,
          id: existing.id,
          descripcion: existing.description,
          monto_pesos: toPesos(existing.amount_cents),
        }
      }),
    }),
  }
}

export type ChatTools = ReturnType<typeof createChatTools>
