import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Mail, Plus, Sparkles } from 'lucide-react'
import { formatCOP } from '@/lib/money'
import type { PeriodSummary } from '@/lib/queries'
import { splitAmount } from './format'
import { Shape } from './shapes'

/**
 * Apertura del Home: una pregunta y una respuesta. La respuesta es lo que
 * queda del mes, en grande; la cifra exacta va debajo para quien quiera
 * cuadrar al peso.
 */
export function Hero({
  name,
  dateLabel,
  monthLabel,
  summary,
}: {
  name: string | null
  dateLabel: string
  monthLabel: string
  summary: PeriodSummary
}) {
  const balance = splitAmount(summary.balanceCents)
  const over = balance.negative

  return (
    <section className="rise">
      <p className="text-sm text-paper-dim first-letter:uppercase">{dateLabel}</p>
      <h1 className="headline mt-3 text-2xl md:text-3xl">
        {name ? `${name}, ¿cómo` : '¿Cómo'} va la plata este mes?
      </h1>

      {/* ---------------------------- La cifra ----------------------------- */}
      <div className="mt-4 flex items-start gap-1">
        <span className="headline mt-3 text-3xl md:mt-5 md:text-4xl">
          {over ? '−$' : '$'}
        </span>
        <span className="relative">
          <span className="headline tabular text-[5.75rem] leading-[0.85] tracking-[-0.06em] md:text-[8rem]">
            {balance.value}
          </span>
          {/* El "sticker" de la referencia: estrella pegada a la cifra. */}
          <Shape
            name="star"
            className={`pop absolute -right-5 -top-4 size-10 md:size-12 ${over ? 'text-chicle' : 'text-lavanda'}`}
          />
        </span>
        <span className="headline mb-2 self-end text-xl md:text-2xl">{balance.unit}</span>
      </div>

      <p className="mt-3 text-sm text-paper-dim">
        {over ? `Te pasaste en ${monthLabel} por ` : `Te quedan de ${monthLabel}: `}
        <span className="tabular text-carbon">{formatCOP(Math.abs(summary.balanceCents))}</span>
      </p>

      {/* ----------------------------- Acciones ---------------------------- */}
      <div className="mt-6 flex items-center gap-2">
        <Link
          href="/efectivo"
          className="flex items-center gap-2 rounded-full bg-carbon py-2.5 pl-4 pr-5 text-sm font-medium text-crema transition-transform hover:-translate-y-0.5"
        >
          <Plus className="size-4" /> Agregar gasto
        </Link>
        <IconLink href="/gmail" label="Sincronizar Bancolombia">
          <Mail className="size-4" />
        </IconLink>
        <IconLink href="/chat" label="Preguntarle a la IA">
          <Sparkles className="size-4" />
        </IconLink>
      </div>

      {/* --------------------------- Entró / Salió ------------------------- */}
      <div className="mt-8 grid grid-cols-2 gap-3">
        <FlowCard
          label="Entró"
          cents={summary.incomeCents}
          className="bg-oliva/45"
          icon={<ArrowDownLeft className="size-4" />}
        />
        <FlowCard
          label="Salió"
          cents={summary.expenseCents}
          className="bg-lavanda/60"
          icon={<ArrowUpRight className="size-4" />}
        />
      </div>
    </section>
  )
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full border border-linea bg-superficie transition-colors hover:border-carbon"
    >
      {children}
    </Link>
  )
}

function FlowCard({
  label,
  cents,
  icon,
  className,
}: {
  label: string
  cents: number
  icon: React.ReactNode
  className: string
}) {
  return (
    <div className={`rounded-[24px] px-4 py-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="grid size-7 place-items-center rounded-full bg-superficie/70">
          {icon}
        </span>
      </div>
      <p className="headline tabular mt-4 text-[1.2rem] tracking-[-0.03em] sm:text-2xl">
        {formatCOP(cents)}
      </p>
    </div>
  )
}
