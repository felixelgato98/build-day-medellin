import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { WORKSPACE_ID } from '@/lib/constants'
import type { Database } from '@/lib/types'
import type { NewTx, TxRow } from './tools'

type TransactionInsert = Database['public']['Tables']['transactions']['Insert']

/**
 * Escritura del chat sobre `transactions`. Vive acá y no en `@/lib/queries`
 * porque la escritura general es del módulo 2; el chat solo necesita insertar
 * como `manual` y borrar lo que él mismo registró.
 *
 * Usa el cliente de sesión, así RLS aplica y `created_by` es el usuario real.
 */

const SELECT_ROW = `
  id, kind, amount_cents, description, merchant, occurred_at, source, created_at,
  category:categories (id, name)
`

export async function insertTransaction(input: NewTx): Promise<TxRow> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const row: TransactionInsert = {
    workspace_id: WORKSPACE_ID,
    created_by: user?.id ?? null,
    kind: input.kind,
    amount_cents: input.amount_cents,
    description: input.description,
    category_id: input.category_id,
    occurred_at: input.occurred_at,
    merchant: input.merchant,
    source: input.source,
  }

  // Los tipos de @/lib/types están escritos a mano y no traen `Relationships`,
  // así que supabase-js no reconoce el schema y tipa el insert como `never`.
  // Validamos contra nuestro propio Insert arriba y casteamos acá.
  const { data, error } = await supabase
    .from('transactions')
    .insert(row as never)
    .select(SELECT_ROW)
    .single()

  if (error) throw new Error(`No se pudo registrar el movimiento: ${error.message}`)
  return data as unknown as TxRow
}

export async function getTransactionById(id: string): Promise<TxRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select(SELECT_ROW)
    .eq('workspace_id', WORKSPACE_ID)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer el movimiento: ${error.message}`)
  return (data as unknown as TxRow | null) ?? null
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('workspace_id', WORKSPACE_ID)
    .eq('id', id)

  if (error) throw new Error(`No se pudo borrar el movimiento: ${error.message}`)
}
