import { cn } from '@/lib/cn'

/** Superficie base. Filete de 1px, sin sombras: esto es papel, no plástico. */
export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'border border-rule bg-ink-2/60 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  eyebrow,
  action,
}: {
  title: string
  eyebrow?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="headline text-lg text-paper">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function CardBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('p-5', className)}>{children}</div>
}
