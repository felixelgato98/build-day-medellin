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
    <div className="rounded-[24px] border-2 border-dashed border-linea px-5 py-4">
      <p className="text-xs font-semibold">Módulo · {module}</p>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">{children}</p>
      <p className="mt-3 text-xs text-paper-faint">
        Tu código va en{' '}
        <code className="rounded-full bg-vainilla/60 px-2 py-0.5 text-carbon">{folder}</code>
      </p>
    </div>
  )
}
