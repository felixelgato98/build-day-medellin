import { PageHeader } from '@/components/ui/page-header'
import { TransactionList } from '@/components/transaction-list'
import { ModuleNotice } from '@/components/ui/module-notice'
import { DbNotReady } from '@/components/ui/db-not-ready'
import { getTransactions } from '@/lib/queries'
import type { TransactionWithCategory } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function TransaccionesPage() {
  let transactions: TransactionWithCategory[] = []
  let error: string | null = null

  try {
    transactions = await getTransactions({ limit: 100 })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido'
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader eyebrow="Log completo" title="Transacciones" />

      <ModuleNotice module="Transacciones + Efectivo" folder="src/features/transactions/">
        La lectura ya funciona. Te toca la ESCRITURA: formulario de crear/editar
        movimiento, gestión de categorías, filtros por tipo/categoría/fecha y
        borrado. Usá Server Actions y validá con zod.
      </ModuleNotice>

      {error ? (
        <DbNotReady detail={error} />
      ) : (
        <TransactionList transactions={transactions} />
      )}
    </div>
  )
}
