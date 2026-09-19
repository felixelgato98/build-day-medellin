/**
 * Banner que marca de quién es cada módulo.
 *
 * Existe a propósito: es la señal visible de los límites de trabajo. Cuando la
 * persona dueña del módulo termine su feature, BORRA este banner de su página.
 */
export function ModuleNotice({
  module,
  folder,
  children,
}: {
  module: string
  folder: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-dashed border-gold/40 bg-gold/5 px-5 py-4">
      <p className="eyebrow text-gold">Módulo · {module}</p>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">{children}</p>
      <p className="tabular mt-3 text-xs text-paper-faint">
        Tu código va en <span className="text-gold">{folder}</span>
      </p>
    </div>
  )
}
