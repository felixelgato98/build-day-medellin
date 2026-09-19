import 'server-only'
import { WORKSPACE_ID } from '@/lib/constants'
import type {
  Category,
  GmailSyncLog,
  TransactionKind,
  TransactionSource,
  TransactionWithCategory,
} from '@/lib/types'

/**
 * MODO DEMO: datos falsos, coherentes y en COP, para mostrar la app sin una
 * base de datos detrás.
 *
 * Se activa de dos formas:
 *   1. `DEMO_DATA=1` en el entorno (Vercel → Settings → Environment Variables).
 *      Sirve para una URL de demostración aunque Supabase SÍ esté configurado.
 *   2. Supabase sin configurar (repo recién clonado, o un proyecto de Vercel
 *      sin las variables). Antes solo el Home mostraba ejemplo; ahora todas las
 *      páginas y el chat leen de acá.
 *
 * Las fechas son relativas a "hoy" para que siempre haya movimientos en el mes
 * y en la semana actuales. Los ids son estables (`demo-…`) para que React no
 * se queje y para que nunca se confundan con un uuid real.
 */

export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function isDemoMode(): boolean {
  const flag = (process.env.DEMO_DATA ?? '').trim().toLowerCase()
  if (flag === '1' || flag === 'true' || flag === 'on') return true
  if (flag === '0' || flag === 'false' || flag === 'off') return false
  return !isSupabaseConfigured()
}

// ------------------------------------------------------------------ Categorías

type CatKey =
  | 'salario'
  | 'freelance'
  | 'ventas'
  | 'rendimientos'
  | 'arriendo'
  | 'mercado'
  | 'restaurantes'
  | 'transporte'
  | 'servicios'
  | 'salud'
  | 'entretenimiento'
  | 'educacion'
  | 'ropa'
  | 'otros'

/** Mismos nombres, íconos y colores que supabase/seed.sql. */
const CATS: Record<CatKey, Pick<Category, 'name' | 'kind' | 'icon' | 'color'>> = {
  salario:         { name: 'Salario',         kind: 'income',  icon: 'wallet',         color: '#22c55e' },
  freelance:       { name: 'Freelance',       kind: 'income',  icon: 'laptop',         color: '#10b981' },
  ventas:          { name: 'Ventas',          kind: 'income',  icon: 'trending-up',    color: '#14b8a6' },
  rendimientos:    { name: 'Rendimientos',    kind: 'income',  icon: 'piggy-bank',     color: '#06b6d4' },
  arriendo:        { name: 'Arriendo',        kind: 'expense', icon: 'home',           color: '#ef4444' },
  mercado:         { name: 'Mercado',         kind: 'expense', icon: 'shopping-cart',  color: '#f97316' },
  restaurantes:    { name: 'Restaurantes',    kind: 'expense', icon: 'utensils',       color: '#f59e0b' },
  transporte:      { name: 'Transporte',      kind: 'expense', icon: 'car',            color: '#eab308' },
  servicios:       { name: 'Servicios',       kind: 'expense', icon: 'zap',            color: '#8b5cf6' },
  salud:           { name: 'Salud',           kind: 'expense', icon: 'heart-pulse',    color: '#ec4899' },
  entretenimiento: { name: 'Entretenimiento', kind: 'expense', icon: 'clapperboard',   color: '#a855f7' },
  educacion:       { name: 'Educación',       kind: 'expense', icon: 'graduation-cap', color: '#3b82f6' },
  ropa:            { name: 'Ropa',            kind: 'expense', icon: 'shirt',          color: '#6366f1' },
  otros:           { name: 'Otros',           kind: 'expense', icon: 'circle-dashed',  color: '#64748b' },
}

const DEMO_EPOCH = '2026-01-01T12:00:00.000Z'

export function buildDemoCategories(kind?: TransactionKind): Category[] {
  return (Object.keys(CATS) as CatKey[])
    .map((key) => ({
      id: `demo-cat-${key}`,
      workspace_id: WORKSPACE_ID,
      created_at: DEMO_EPOCH,
      ...CATS[key],
    }))
    .filter((c) => !kind || c.kind === kind)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

// --------------------------------------------------------------- Transacciones

type Row = [
  daysAgo: number,
  kind: TransactionKind,
  pesos: number,
  description: string,
  cat: CatKey,
  source: TransactionSource,
  merchant: string | null,
]

/**
 * Dos meses de vida de un hogar en Medellín. Mezcla deliberada de los tres
 * orígenes para que las páginas de Efectivo y Gmail también tengan qué mostrar.
 */
const ROWS: Row[] = [
  // --- Esta semana
  [0,  'expense',    18_000, 'Empanadas en el parque',        'restaurantes',    'cash',   'Empanadas Doña Rosa'],
  [0,  'expense',    31_800, 'Uber a Laureles',               'transporte',      'gmail',  'Uber'],
  [0,  'expense',     2_900, 'Metro',                         'transporte',      'cash',   'Metro de Medellín'],
  [1,  'expense',   164_200, 'Mercado semanal',               'mercado',         'gmail',  'Carulla Laureles'],
  [1,  'expense',     8_900, 'Café con cliente',              'restaurantes',    'gmail',  'Juan Valdez'],
  [2,  'expense',    23_500, 'Café y torta',                  'restaurantes',    'cash',   'Pergamino Café'],
  [2,  'income',  4_500_000, 'Salario quincena',              'salario',         'gmail',  'Bancolombia'],
  [2,  'expense',    38_900, 'Suscripción música',            'entretenimiento', 'gmail',  'Spotify'],
  [3,  'expense',    78_500, 'Mercado rápido',                'mercado',         'cash',   'D1 del barrio'],
  [3,  'expense',    62_000, 'Cine con parche',               'entretenimiento', 'gmail',  'Procinal'],
  [3,  'expense', 1_800_000, 'Arriendo apartamento',          'arriendo',        'gmail',  'Inmobiliaria'],
  [4,  'expense',    24_300, 'Uber al centro',                'transporte',      'gmail',  'Uber'],
  [4,  'expense',    44_900, 'Suscripción streaming',         'entretenimiento', 'gmail',  'Netflix'],
  [5,  'expense',   142_000, 'Almuerzo con la familia',       'restaurantes',    'gmail',  'Hatoviejo'],
  [5,  'expense',   215_000, 'Energía y gas',                 'servicios',       'gmail',  'EPM'],
  [6,  'income',  1_450_000, 'Pago proyecto landing',         'freelance',       'manual', 'Cliente Bogotá'],
  [6,  'expense',    58_600, 'Droguería',                     'salud',           'cash',   'Droguería Pasteur'],
  [6,  'expense',    89_000, 'Internet hogar',                'servicios',       'gmail',  'Claro'],
  // --- Semanas anteriores del mes
  [7,  'expense',    50_000, 'Recarga Cívica',                'transporte',      'cash',   'Metro de Medellín'],
  [7,  'expense',   150_000, 'Gimnasio',                      'salud',           'gmail',  'Smart Fit'],
  [8,  'expense',    80_000, 'Regalo cumpleaños',             'otros',           'cash',   null],
  [8,  'expense',   318_000, 'Mercado semanal',               'mercado',         'gmail',  'Éxito Poblado'],
  [9,  'expense',    96_000, 'Cena',                          'restaurantes',    'gmail',  'Crepes & Waffles'],
  [9,  'expense',    82_000, 'Taxi al aeropuerto',            'transporte',      'cash',   'Taxi'],
  [10, 'expense',   120_000, 'Gasolina',                      'transporte',      'gmail',  'Terpel'],
  [10, 'expense',   124_000, 'Frutas y verduras',             'mercado',         'cash',   'Plaza Minorista'],
  [11, 'expense',   224_000, 'Cena con amigos',               'restaurantes',    'gmail',  'Rappi'],
  [11, 'expense',   125_000, 'Peluquería',                    'otros',           'cash',   'Barbería'],
  [12, 'expense',   342_900, 'Mercado semanal',               'mercado',         'gmail',  'Éxito Poblado'],
  [12, 'expense',    42_000, 'Acueducto',                     'servicios',       'gmail',  'EPM'],
  [13, 'expense',   119_900, 'Plan celular',                  'servicios',       'gmail',  'Tigo'],
  [14, 'expense',   320_000, 'Consulta médica',               'salud',           'gmail',  'Clínica Las Américas'],
  [14, 'expense',    42_000, 'Almuerzo',                      'restaurantes',    'cash',   'Corrientazo'],
  [15, 'expense',    99_000, 'Curso online',                  'educacion',       'gmail',  'Platzi'],
  [15, 'expense',    87_000, 'Farmacia',                      'salud',           'gmail',  'Cruz Verde'],
  [16, 'expense',    67_000, 'Desayuno',                      'restaurantes',    'cash',   'Panadería'],
  [17, 'income',  4_500_000, 'Salario quincena',              'salario',         'gmail',  'Bancolombia'],
  [18, 'expense',    98_000, 'Mercado rápido',                'mercado',         'gmail',  'Ara'],
  [19, 'expense',   189_000, 'Domicilio',                     'restaurantes',    'gmail',  'Rappi'],
  [20, 'expense',    64_000, 'Cabify',                        'transporte',      'gmail',  'Cabify'],
  [21, 'expense',    38_000, 'Almuerzo',                      'restaurantes',    'cash',   'Corrientazo'],
  [22, 'expense',   334_000, 'Mercado semanal',               'mercado',         'gmail',  'Carulla'],
  [23, 'expense',   890_000, 'Ropa',                          'ropa',            'gmail',  'Falabella'],
  [24, 'expense',   141_000, 'Frutas y verduras',             'mercado',         'cash',   'Plaza Minorista'],
  [25, 'income',  2_400_000, 'Consultoría automatización',    'freelance',       'manual', 'Cliente Medellín'],
  [26, 'expense',   123_000, 'Cena',                          'restaurantes',    'gmail',  'Rappi'],
  [27, 'expense',    68_000, 'Papelería',                     'otros',           'cash',   'Panamericana'],
  [28, 'expense',   172_000, 'Gasolina',                      'transporte',      'gmail',  'Terpel'],
  // --- Mes pasado
  [30, 'income',    124_000, 'Rendimientos cuenta ahorro',    'rendimientos',    'gmail',  'Bancolombia'],
  [31, 'expense',   240_000, 'Regalo cumpleaños',             'otros',           'cash',   null],
  [32, 'expense',    38_900, 'Suscripción música',            'entretenimiento', 'gmail',  'Spotify'],
  [32, 'income',  4_500_000, 'Salario quincena',              'salario',         'gmail',  'Bancolombia'],
  [33, 'expense',    44_900, 'Suscripción streaming',         'entretenimiento', 'gmail',  'Netflix'],
  [33, 'expense', 1_800_000, 'Arriendo apartamento',          'arriendo',        'gmail',  'Inmobiliaria'],
  [35, 'expense',   198_000, 'Energía y gas',                 'servicios',       'gmail',  'EPM'],
  [36, 'expense',    89_000, 'Internet hogar',                'servicios',       'gmail',  'Claro'],
  [37, 'expense',   150_000, 'Gimnasio',                      'salud',           'gmail',  'Smart Fit'],
  [38, 'income',    950_000, 'Venta equipo usado',            'ventas',          'manual', 'Mercado Libre'],
  [40, 'expense',   280_000, 'Concierto',                     'entretenimiento', 'gmail',  'Tuboleta'],
  [41, 'expense',    29_000, 'Metro',                         'transporte',      'cash',   'Metro de Medellín'],
  [43, 'expense',   276_000, 'Mercado semanal',               'mercado',         'gmail',  'Éxito'],
  [45, 'expense',    45_000, 'Almuerzo',                      'restaurantes',    'cash',   'Corrientazo'],
  [47, 'income',  4_500_000, 'Salario quincena',              'salario',         'gmail',  'Bancolombia'],
  [50, 'expense',   112_000, 'Cine',                          'entretenimiento', 'cash',   'Cine Colombia'],
  [52, 'expense',   269_000, 'Mercado semanal',               'mercado',         'gmail',  'Éxito'],
  [55, 'expense',    56_000, 'Café de la tarde',              'restaurantes',    'cash',   'Pergamino Café'],
  [60, 'income',    118_000, 'Rendimientos cuenta ahorro',    'rendimientos',    'gmail',  'Bancolombia'],
  [63, 'expense', 1_800_000, 'Arriendo apartamento',          'arriendo',        'gmail',  'Inmobiliaria'],
]

export function buildDemoTransactions(now = new Date()): TransactionWithCategory[] {
  return ROWS.map(([daysAgo, kind, pesos, description, cat, source, merchant], i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    // Horas distintas para que el orden dentro de un mismo día no sea plano,
    // pero nunca en el futuro: "hoy" arranca temprano.
    d.setHours(daysAgo === 0 ? 7 + (i % 3) : 19 - (i % 11), (i * 7) % 60, 0, 0)
    const iso = d.toISOString()
    const id = `demo-${String(i + 1).padStart(2, '0')}`
    const category = { id: `demo-cat-${cat}`, ...CATS[cat] }

    return {
      id,
      workspace_id: WORKSPACE_ID,
      created_by: null,
      kind,
      amount_cents: pesos * 100,
      currency: 'COP',
      description,
      category_id: category.id,
      occurred_at: iso,
      source,
      // Igual que en el seed: solo Gmail trae una referencia estable del origen.
      source_ref: source === 'gmail' ? `demo-msg-${id}` : null,
      merchant,
      raw: null,
      created_at: iso,
      updated_at: iso,
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
    }
  }).sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
}

export interface DemoTransactionFilters {
  kind?: TransactionKind
  source?: TransactionSource
  categoryId?: string
  from?: string
  to?: string
  limit?: number
}

/** Aplica en memoria los mismos filtros que `getTransactions` manda a Supabase. */
export function filterDemoTransactions(
  rows: TransactionWithCategory[],
  f: DemoTransactionFilters = {},
): TransactionWithCategory[] {
  let out = rows
  if (f.kind) out = out.filter((t) => t.kind === f.kind)
  if (f.source) out = out.filter((t) => t.source === f.source)
  if (f.categoryId) out = out.filter((t) => t.category_id === f.categoryId)
  if (f.from) out = out.filter((t) => t.occurred_at >= f.from!)
  if (f.to) out = out.filter((t) => t.occurred_at <= f.to!)
  if (f.limit) out = out.slice(0, f.limit)
  return out
}

// --------------------------------------------------------------------- Gmail

/** Historial de sincronizaciones de ejemplo para la página de Gmail. */
export function buildDemoSyncLog(now = new Date()): GmailSyncLog[] {
  const runs: Array<[daysAgo: number, seen: number, saved: number]> = [
    [0, 12, 3],
    [1, 9, 2],
    [2, 15, 4],
  ]
  return runs.map(([daysAgo, seen, saved], i) => {
    const started = new Date(now)
    started.setDate(started.getDate() - daysAgo)
    started.setHours(6, 30, 0, 0)
    const finished = new Date(started.getTime() + 8_000 + i * 2_500)
    return {
      id: `demo-sync-${i + 1}`,
      workspace_id: WORKSPACE_ID,
      account_id: null,
      started_at: started.toISOString(),
      finished_at: finished.toISOString(),
      messages_seen: seen,
      messages_saved: saved,
      error: null,
    }
  })
}
