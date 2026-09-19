import { PageHeader } from '@/components/ui/page-header'
import { TransactionList } from '@/components/transaction-list'
import { StatCard } from '@/components/ui/stat-card'
import { ModuleNotice } from '@/components/ui/module-notice'
import { DbNotReady } from '@/components/ui/db-not-ready'
import { getTransactions, currentMonthRange } from '@/lib/queries'
import type { TransactionWithCategory } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function EfectivoPage() {
  const { from, to } = currentMonthRange()

  let transactions: TransactionWithCategory[] = []
  let error: string | null = null

  try {
    // Efectivo NO es una tabla aparte: es transactions con source='cash'.
    transactions = await getTransactions({ source: 'cash', limit: 100 })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido'
  }

  const monthTotal = transactions
    .filter((t) => t.occurred_at >= from && t.occurred_at <= to)
    .reduce((sum, t) => sum + t.amount_cents, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader eyebrow="Sin rastro bancario" title="Gastos en efectivo" />

      <ModuleNotice module="Gastos en efectivo" folder="src/features/transactions/">
        Lo que gastás en billetes no llega por correo, así que hay que capturarlo
        a mano y rápido. Te toca: formulario de captura en 2 toques, categorías
        frecuentes de acceso directo y, si te alcanza el tiempo, foto del recibo
        con Vercel Blob. Siempre insertando con{' '}
        <span className="tabular text-gold">source: &apos;cash&apos;</span>.
      </ModuleNotice>

      {error ? (
        <DbNotReady detail={error} />
      ) : (
        <>
          <div className="rise grid gap-px bg-rule sm:grid-cols-2">
            <StatCard label="Efectivo este mes" cents={monthTotal} tone="expense" />
            <StatCard
              label="Total registrado"
              cents={transactions.reduce((s, t) => s + t.amount_cents, 0)}
              hint={`${transactions.length} movimientos en efectivo`}
            />
          </div>

          <TransactionList
            transactions={transactions}
            emptyTitle="Sin gastos en efectivo"
            emptyDescription="Cuando registres el primero aparecerá acá."
          />
        </>
      )}
    </div>
  )
}
