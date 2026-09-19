export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border border-dashed border-rule px-6 py-12 text-center">
      <p className="headline text-base text-paper-dim">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-paper-faint">{description}</p>
    </div>
  )
}
