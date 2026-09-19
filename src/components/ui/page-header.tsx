export function PageHeader({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <header className="rise">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="headline mt-2 text-4xl md:text-5xl">{title}</h1>
    </header>
  )
}
