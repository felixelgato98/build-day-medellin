export function PageHeader({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <header className="rise">
      <p className="eyebrow text-gold">{eyebrow}</p>
      <h1 className="headline mt-2 text-4xl text-paper md:text-5xl">{title}</h1>
      <div className="rule-dotted mt-5 h-px" />
    </header>
  )
}
