export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-[28px] border-2 border-dashed border-linea px-6 py-12 text-center">
      <p className="headline text-lg">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-paper-dim">{description}</p>
    </div>
  )
}
