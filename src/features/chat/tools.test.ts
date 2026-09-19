import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createChatTools, type ChatToolDeps, type TxRow } from './tools'

const NOW = new Date('2026-09-19T15:00:00.000Z')

const CATS = [
  { id: 'c-mercado', name: 'Mercado', kind: 'expense' as const },
  { id: 'c-resto', name: 'Restaurantes', kind: 'expense' as const },
  { id: 'c-salario', name: 'Salario', kind: 'income' as const },
]

function tx(partial: Partial<TxRow>): TxRow {
  return {
    id: 't1',
    kind: 'expense',
    amount_cents: 2000000,
    description: 'Almuerzo',
    merchant: null,
    occurred_at: '2026-09-18T12:00:00.000Z',
    source: 'manual',
    created_at: '2026-09-18T12:00:00.000Z',
    category: { id: 'c-resto', name: 'Restaurantes' },
    ...partial,
  }
}

function fakeDeps(rows: TxRow[] = []) {
  const calls: Record<string, unknown[]> = { getTransactions: [], insert: [], delete: [] }
  const deps: ChatToolDeps = {
    now: () => NOW,
    getCategories: async (kind) => (kind ? CATS.filter((c) => c.kind === kind) : CATS),
    getTransactions: async (filters) => {
      calls.getTransactions.push(filters)
      return rows
    },
    getSummary: async () => ({
      incomeCents: 500000000,
      expenseCents: 2000000,
      balanceCents: 498000000,
      count: 2,
    }),
    getSpendByCategory: async () => [
      { categoryId: 'c-resto', name: 'Restaurantes', color: null, icon: null, totalCents: 2000000 },
    ],
    getTransactionById: async (id) => rows.find((r) => r.id === id) ?? null,
    insertTransaction: async (input) => {
      calls.insert.push(input)
      return tx({ id: 't-new', ...input, category: { id: input.category_id, name: 'Mercado' } })
    },
    deleteTransaction: async (id) => {
      calls.delete.push(id)
    },
  }
  return { deps, calls }
}

// El AI SDK pasa opciones (toolCallId, messages...) que las tools no usan.
const OPTS = { toolCallId: 'call-1', messages: [] } as never

test('listar_categorias devuelve nombre, tipo e id', async () => {
  const { deps } = fakeDeps()
  const tools = createChatTools(deps)
  const out = await tools.listar_categorias.execute!({}, OPTS)
  assert.deepEqual(out, {
    categorias: [
      { id: 'c-mercado', nombre: 'Mercado', tipo: 'expense' },
      { id: 'c-resto', nombre: 'Restaurantes', tipo: 'expense' },
      { id: 'c-salario', nombre: 'Salario', tipo: 'income' },
    ],
  })
})

test('buscar_transacciones resuelve la categoría por nombre y devuelve pesos', async () => {
  const { deps, calls } = fakeDeps([tx({})])
  const tools = createChatTools(deps)
  const out = await tools.buscar_transacciones.execute!({ categoria: 'restaurantes' }, OPTS)
  assert.equal(calls.getTransactions.length, 1)
  const filters = calls.getTransactions[0] as { categoryId?: string }
  assert.equal(filters.categoryId, 'c-resto')
  assert.deepEqual(out, {
    total: 1,
    movimientos: [
      {
        id: 't1',
        tipo: 'expense',
        monto_pesos: 20000,
        descripcion: 'Almuerzo',
        comercio: null,
        categoria: 'Restaurantes',
        fecha: '2026-09-18',
        origen: 'manual',
      },
    ],
  })
})

test('buscar_transacciones limita a 50 resultados como máximo', async () => {
  const { deps, calls } = fakeDeps()
  const tools = createChatTools(deps)
  await tools.buscar_transacciones.execute!({ limite: 500 }, OPTS)
  const filters = calls.getTransactions[0] as { limit?: number }
  assert.equal(filters.limit, 50)
})

test('buscar_transacciones filtra por texto en descripción o comercio', async () => {
  const rows = [
    tx({ id: 'a', description: 'Uber al trabajo', merchant: null }),
    tx({ id: 'b', description: 'Cena', merchant: 'Crepes y Waffles' }),
    tx({ id: 'c', description: 'Mercado', merchant: 'Éxito' }),
  ]
  const { deps } = fakeDeps(rows)
  const tools = createChatTools(deps)
  const out = (await tools.buscar_transacciones.execute!({ texto: 'crepes' }, OPTS)) as {
    movimientos: { id: string }[]
  }
  assert.deepEqual(out.movimientos.map((m) => m.id), ['b'])
})

test('buscar_transacciones con categoría desconocida devuelve error con opciones', async () => {
  const { deps, calls } = fakeDeps()
  const tools = createChatTools(deps)
  const out = (await tools.buscar_transacciones.execute!({ categoria: 'Comida' }, OPTS)) as {
    error: string
  }
  assert.match(out.error, /Comida/)
  assert.match(out.error, /Mercado/)
  assert.equal(calls.getTransactions.length, 0)
})

test('resumen_periodo devuelve totales en pesos con el rango usado', async () => {
  const { deps } = fakeDeps()
  const tools = createChatTools(deps)
  const out = await tools.resumen_periodo.execute!({}, OPTS)
  assert.deepEqual(out, {
    desde: '2026-09-01',
    hasta: '2026-09-30',
    ingresos_pesos: 5000000,
    gastos_pesos: 20000,
    balance_pesos: 4980000,
    movimientos: 2,
  })
})

test('gasto_por_categoria devuelve el desglose en pesos', async () => {
  const { deps } = fakeDeps()
  const tools = createChatTools(deps)
  const out = await tools.gasto_por_categoria.execute!(
    { desde: '2026-09-01', hasta: '2026-09-15' },
    OPTS,
  )
  assert.deepEqual(out, {
    desde: '2026-09-01',
    hasta: '2026-09-15',
    categorias: [{ categoria: 'Restaurantes', total_pesos: 20000 }],
  })
})

test('registrar_movimiento convierte a centavos e inserta como manual', async () => {
  const { deps, calls } = fakeDeps()
  const tools = createChatTools(deps)
  const out = await tools.registrar_movimiento.execute!(
    { tipo: 'expense', monto_pesos: 45000, descripcion: 'Mercado semanal', categoria: 'mercado' },
    OPTS,
  )
  assert.deepEqual(calls.insert[0], {
    kind: 'expense',
    amount_cents: 4500000,
    description: 'Mercado semanal',
    category_id: 'c-mercado',
    occurred_at: NOW.toISOString(),
    merchant: null,
    source: 'manual',
  })
  assert.deepEqual(out, {
    registrado: true,
    movimiento: {
      id: 't-new',
      tipo: 'expense',
      monto_pesos: 45000,
      descripcion: 'Mercado semanal',
      comercio: null,
      categoria: 'Mercado',
      fecha: '2026-09-19',
      origen: 'manual',
    },
  })
})

test('registrar_movimiento rechaza montos inválidos sin tocar la DB', async () => {
  const { deps, calls } = fakeDeps()
  const tools = createChatTools(deps)
  const out = (await tools.registrar_movimiento.execute!(
    { tipo: 'expense', monto_pesos: -10, descripcion: 'x', categoria: 'Mercado' },
    OPTS,
  )) as { error: string }
  assert.match(out.error, /monto/i)
  assert.equal(calls.insert.length, 0)
})

test('registrar_movimiento rechaza categoría de otro tipo', async () => {
  const { deps, calls } = fakeDeps()
  const tools = createChatTools(deps)
  const out = (await tools.registrar_movimiento.execute!(
    { tipo: 'expense', monto_pesos: 100, descripcion: 'x', categoria: 'Salario' },
    OPTS,
  )) as { error: string }
  assert.match(out.error, /Salario/)
  assert.equal(calls.insert.length, 0)
})

test('registrar_movimiento acepta una fecha dada', async () => {
  const { deps, calls } = fakeDeps()
  const tools = createChatTools(deps)
  await tools.registrar_movimiento.execute!(
    { tipo: 'income', monto_pesos: 100, descripcion: 'Pago', categoria: 'Salario', fecha: '2026-09-05' },
    OPTS,
  )
  const input = calls.insert[0] as { occurred_at: string }
  assert.equal(input.occurred_at, '2026-09-05T00:00:00.000Z')
})

test('eliminar_movimiento borra un manual reciente', async () => {
  const { deps, calls } = fakeDeps([tx({ id: 't1', created_at: '2026-09-19T10:00:00.000Z' })])
  const tools = createChatTools(deps)
  const out = await tools.eliminar_movimiento.execute!({ id: 't1' }, OPTS)
  assert.deepEqual(calls.delete, ['t1'])
  assert.deepEqual(out, { eliminado: true, id: 't1', descripcion: 'Almuerzo', monto_pesos: 20000 })
})

test('eliminar_movimiento rechaza lo que no es manual reciente', async () => {
  const { deps, calls } = fakeDeps([tx({ id: 't1', source: 'gmail' })])
  const tools = createChatTools(deps)
  const out = (await tools.eliminar_movimiento.execute!({ id: 't1' }, OPTS)) as { error: string }
  assert.match(out.error, /gmail/)
  assert.equal(calls.delete.length, 0)
})

test('eliminar_movimiento avisa si el id no existe', async () => {
  const { deps } = fakeDeps()
  const tools = createChatTools(deps)
  const out = (await tools.eliminar_movimiento.execute!({ id: 'nope' }, OPTS)) as { error: string }
  assert.match(out.error, /no existe|no encontr/i)
})

test('las tools devuelven error legible si la DB falla', async () => {
  const { deps } = fakeDeps()
  deps.getCategories = async () => {
    throw new Error('connection refused')
  }
  const tools = createChatTools(deps)
  const out = (await tools.listar_categorias.execute!({}, OPTS)) as { error: string }
  assert.match(out.error, /connection refused/)
})
