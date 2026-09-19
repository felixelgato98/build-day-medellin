/**
 * Se muestra cuando Supabase todavía no está conectado.
 * Evita que la app explote con un stack trace para quien clona el repo
 * antes de tener el .env.local.
 */
export function DbNotReady({ detail }: { detail?: string }) {
  return (
    <div className="border border-red/40 bg-red/5 px-5 py-4">
      <p className="eyebrow text-red">Base de datos no conectada</p>
      <p className="mt-2 text-sm text-paper-dim">
        Corré <span className="tabular text-gold">vercel env pull .env.local</span> y
        después <span className="tabular text-gold">npm run db:push</span>. El detalle
        está en <span className="tabular text-gold">README.md</span>.
      </p>
      {detail && (
        <p className="tabular mt-3 text-xs text-paper-faint">{detail}</p>
      )}
    </div>
  )
}
