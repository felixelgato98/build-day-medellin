import { cn } from '@/lib/cn'

/** Superficie base: redonda, clara y sin sombra. Las formas de color van adentro. */
export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-[28px] bg-superficie', className)}>
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
    <div className="flex items-end justify-between gap-4 px-5 pb-2 pt-5">
      <div>
        <h2 className="headline text-xl">{title}</h2>
        {eyebrow && <p className="eyebrow mt-1">{eyebrow}</p>}
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
