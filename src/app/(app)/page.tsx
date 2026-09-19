import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { SourceTag } from '@/components/ui/source-tag'
import { ModuleNotice } from '@/components/ui/module-notice'
import { DbNotReady } from '@/components/ui/db-not-ready'
import { formatCOP } from '@/lib/money'
import {
  getSummary,
  getSpendByCategory,
  getTransactions,
  currentMonthRange,
} from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { from, to } = currentMonthRange()

  let data
  try {
    const [summary, byCategory, recent] = await Promise.all([
      getSummary(from, to),
      getSpendByCategory(from, to),
      getTransactions({ limit: 8 }),
    ])
    data = { summary, byCategory, recent }
  } catch (e) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Header />
        <DbNotReady detail={e instanceof Error ? e.message : undefined} />
      </div>
    )
  }

  const { summary, byCategory, recent } = data
  const maxCategory = byCategory[0]?.totalCents ?? 1

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Header />

      {/* ------------------------- Cifras del mes ------------------------- */}
      <section className="rise grid gap-px bg-rule sm:grid-cols-3">
        <StatCard label="Ingresos del mes" cents={summary.incomeCents} tone="income" />
        <StatCard label="Gastos del mes" cents={summary.expenseCents} tone="expense" />
        <StatCard
          label="Balance"
          cents={summary.balanceCents}
          tone={summary.balanceCents >= 0 ? 'income' : 'expense'}
          hint={`${summary.count} movimientos`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ----------------------- Gasto por categoría ---------------------- */}
        <Card className="rise" >
          <CardHeader eyebrow="Este mes" title="Gasto por categoría" />
          <CardBody className="space-y-3">
            {byCategory.length === 0 && (
              <p className="text-sm text-paper-faint">Sin gastos este mes.</p>
            )}
            {byCategory.slice(0, 7).map((c) => (
              <div key={c.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-paper-dim">{c.name}</span>
                  <span className="tabular shrink-0 text-sm text-paper">
                    {formatCOP(c.totalCents)}
                  </span>
                </div>
                {/* Barra proporcional al mayor gasto */}
                <div className="mt-1.5 h-[3px] bg-rule-soft">
                  <div
                    className="h-full"
                    style={{
                      width: `${(c.totalCents / maxCategory) * 100}%`,
                      backgroundColor: c.color ?? 'var(--color-gold)',
                    }}
                  />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* ------------------------- Últimos movimientos -------------------- */}
        <Card className="rise">
          <CardHeader eyebrow="Log" title="Últimos movimientos" />
          <CardBody className="space-y-0 p-0">
            {recent.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 border-b border-rule-soft px-5 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-paper">{t.description}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <SourceTag source={t.source} />
                    <span className="text-xs text-paper-faint">
                      {t.category?.name ?? 'Sin categoría'}
                    </span>
                  </div>
                </div>
                <span
                  className={`tabular shrink-0 text-sm ${
                    t.kind === 'income' ? 'text-green' : 'text-red'
                  }`}
                >
                  {t.kind === 'income' ? '+' : '−'} {formatCOP(t.amount_cents)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <ModuleNotice module="Dashboard" folder="src/features/dashboard/">
        Esta es una versión mínima que ya lee datos reales. Te toca a vos:
        gráficas de evolución mensual, comparativo contra el mes anterior,
        filtros por rango de fechas y separar efectivo vs Bancolombia.
      </ModuleNotice>
    </div>
  )
}

function Header() {
  return (
    <header className="rise">
      <p className="eyebrow text-gold">Resumen</p>
      <h1 className="headline mt-2 text-4xl text-paper md:text-5xl">Dashboard</h1>
      <div className="rule-dotted mt-5 h-px" />
    </header>
  )
}
