import type { TransactionWithCategory, TransactionSource } from '@/lib/types'
import { WORKSPACE_ID } from '@/lib/constants'

/**
 * Datos de ejemplo para ver el Home sin Supabase (repo recién clonado, o
 * trabajo de diseño). Las fechas son relativas a "hoy" para que siempre caigan
 * en el mes y la semana actuales. La página avisa cuando los está usando.
 */

const CATS = {
  salario:      { id: 'c-salario',  name: 'Salario',         icon: 'wallet',         color: null },
  freelance:    { id: 'c-free',     name: 'Freelance',       icon: 'laptop',         color: null },
  arriendo:     { id: 'c-arriendo', name: 'Arriendo',        icon: 'home',           color: null },
  mercado:      { id: 'c-mercado',  name: 'Mercado',         icon: 'shopping-cart',  color: null },
  restaurantes: { id: 'c-rest',     name: 'Restaurantes',    icon: 'utensils',       color: null },
  transporte:   { id: 'c-transp',   name: 'Transporte',      icon: 'car',            color: null },
  servicios:    { id: 'c-serv',     name: 'Servicios',       icon: 'zap',            color: null },
  salud:        { id: 'c-salud',    name: 'Salud',           icon: 'heart-pulse',    color: null },
  entrete:      { id: 'c-entre',    name: 'Entretenimiento', icon: 'clapperboard',   color: null },
  educacion:    { id: 'c-edu',      name: 'Educación',       icon: 'graduation-cap', color: null },
  otros:        { id: 'c-otros',    name: 'Otros',           icon: 'circle-dashed',  color: null },
} as const

type Row = [
  daysAgo: number,
  kind: 'income' | 'expense',
  pesos: number,
  description: string,
  cat: keyof typeof CATS,
  source: TransactionSource,
]

const ROWS: Row[] = [
  [0,  'expense', 18_000,    'Empanadas en el parque',     'restaurantes', 'cash'],
  [0,  'expense', 31_800,    'Uber a Laureles',            'transporte',   'gmail'],
  [1,  'expense', 164_200,   'Carulla Laureles',           'mercado',      'gmail'],
  [2,  'expense', 23_500,    'Pergamino Café',             'restaurantes', 'cash'],
  [3,  'expense', 78_500,    'D1 del barrio',              'mercado',      'cash'],
  [3,  'expense', 62_000,    'Cine Procinal',              'entrete',      'gmail'],
  [4,  'expense', 24_300,    'Uber al centro',             'transporte',   'gmail'],
  [5,  'expense', 142_000,   'Hatoviejo con la familia',   'restaurantes', 'gmail'],
  [6,  'income',  1_450_000, 'Pago proyecto landing',      'freelance',    'manual'],
  [6,  'expense', 58_600,    'Droguería Pasteur',          'salud',        'cash'],
  [7,  'expense', 50_000,    'Recarga Cívica',             'transporte',   'cash'],
  [8,  'expense', 80_000,    'Regalo cumpleaños',          'otros',        'cash'],
  [9,  'expense', 96_000,    'Crepes & Waffles',           'restaurantes', 'gmail'],
  [10, 'expense', 120_000,   'Gasolina Terpel',            'transporte',   'gmail'],
  [12, 'expense', 342_900,   'Éxito Poblado',              'mercado',      'gmail'],
  [13, 'expense', 119_900,   'Claro hogar',                'servicios',    'gmail'],
  [14, 'expense', 286_700,   'EPM agua y luz',             'servicios',    'gmail'],
  [15, 'expense', 99_000,    'Platzi mensual',             'educacion',    'gmail'],
  [16, 'expense', 44_900,    'Netflix',                    'entrete',      'gmail'],
  [18, 'expense', 1_850_000, 'Arriendo apartamento',       'arriendo',     'manual'],
  [18, 'income',  6_200_000, 'Salario',                    'salario',      'manual'],
]

export function buildSampleTransactions(now: Date): TransactionWithCategory[] {
  return ROWS.map(([daysAgo, kind, pesos, description, cat, source], i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    d.setHours(12 - (i % 5), 0, 0, 0)
    const iso = d.toISOString()
    const category = CATS[cat]

    return {
      id: `sample-${i}`,
      workspace_id: WORKSPACE_ID,
      created_by: null,
      kind,
      amount_cents: pesos * 100,
      currency: 'COP',
      description,
      category_id: category.id,
      occurred_at: iso,
      source,
      source_ref: null,
      merchant: null,
      raw: null,
      created_at: iso,
      updated_at: iso,
      category,
    }
  })
}
