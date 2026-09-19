import { PageHeader } from '@/components/ui/page-header'
import { TransactionList } from '@/components/transaction-list'
import { ModuleNotice } from '@/components/ui/module-notice'
import { DbNotReady } from '@/components/ui/db-not-ready'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { getTransactions } from '@/lib/queries'
import type { TransactionWithCategory } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function GmailPage() {
  let transactions: TransactionWithCategory[] = []
  let error: string | null = null

  try {
    transactions = await getTransactions({ source: 'gmail', limit: 100 })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido'
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader eyebrow="Ingesta automática" title="Gmail · Bancolombia" />

      <ModuleNotice module="Gmail / Bancolombia" folder="src/features/gmail/">
        Sin empezar — es tuyo completo. OAuth de Google con scope{' '}
        <span className="tabular text-gold">gmail.readonly</span>, leer los
        correos de Bancolombia, parsearlos y escribirlos como transacciones.
      </ModuleNotice>

      {/* El contrato: lo único que NO podés cambiar sin avisar al equipo. */}
      <Card>
        <CardHeader eyebrow="No negociable" title="El contrato con el resto del equipo" />
        <CardBody className="space-y-4 text-sm leading-relaxed text-paper-dim">
          <p>
            Todo lo que parsees se inserta en{' '}
            <span className="tabular text-gold">transactions</span> con{' '}
            <span className="tabular text-gold">source: &apos;gmail&apos;</span>. No crees
            tablas nuevas de movimientos: el Dashboard lee de ahí.
          </p>
          <p>
            <span className="text-paper">Idempotencia obligatoria.</span> Poné el
            message-id del correo en{' '}
            <span className="tabular text-gold">source_ref</span>. Hay un índice
            único sobre{' '}
            <span className="tabular text-gold">(workspace_id, source, source_ref)</span>,
            así que reprocesar el buzón no puede duplicar gastos.
          </p>
          <p>
            <span className="text-paper">Plata en centavos.</span> Un correo que
            dice <span className="tabular">$45.000</span> se guarda como{' '}
            <span className="tabular text-gold">4500000</span>. Usá{' '}
            <span className="tabular text-gold">parseCOPToCents()</span> de{' '}
            <span className="tabular text-gold">@/lib/money</span>.
          </p>
          <p>
            Guardá el correo crudo en{' '}
            <span className="tabular text-gold">raw</span> — te va a salvar
            cuando un formato raro no parsee.
          </p>
        </CardBody>
      </Card>

      {error ? (
        <DbNotReady detail={error} />
      ) : (
        <>
          <p className="eyebrow">
            Movimientos con origen Gmail · {transactions.length}
          </p>
          <TransactionList
            transactions={transactions}
            emptyTitle="Sin movimientos de Gmail"
            emptyDescription="Cuando conectes la cuenta y corra el primer sync, aparecen acá."
          />
        </>
      )}
    </div>
  )
}
