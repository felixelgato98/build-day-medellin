import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ModuleNotice } from '@/components/ui/module-notice'
import { DbNotReady } from '@/components/ui/db-not-ready'
import { getCurrentUser } from '@/lib/queries'
import { getHomeData } from '@/features/dashboard/data'
import { nameFromEmail } from '@/features/dashboard/format'
import { Hero } from '@/features/dashboard/hero'
import { SpendShapes } from '@/features/dashboard/spend-shapes'
import { WeekCard } from '@/features/dashboard/week-card'
import { RecentList } from '@/features/dashboard/recent-list'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const now = new Date()
  const monthLabel = format(now, 'MMMM', { locale: es })
  const dateLabel = format(now, "EEEE d 'de' MMMM", { locale: es })

  let data
  try {
    data = await getHomeData(now)
  } catch (e) {
    return <DbNotReady detail={e instanceof Error ? e.message : undefined} />
  }

  const user = await getCurrentUser()

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
        <div className="space-y-12">
          <Hero
            name={nameFromEmail(user?.email)}
            dateLabel={dateLabel}
            monthLabel={monthLabel}
            summary={data.summary}
          />
          <SpendShapes
            categories={data.byCategory}
            totalExpenseCents={data.summary.expenseCents}
            monthLabel={monthLabel}
          />
        </div>

        <div className="space-y-6 lg:pt-2">
          <WeekCard days={data.week} />
          <RecentList transactions={data.recent} />
        </div>
      </div>

      <ModuleNotice module="Dashboard" folder="src/features/dashboard/">
        Home con el nuevo sistema visual. Falta: evolución mensual, comparativo
        contra el mes anterior, filtro por fechas y desglose efectivo vs
        Bancolombia.
      </ModuleNotice>
    </div>
  )
}
