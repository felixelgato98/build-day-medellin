/**
 * Se muestra cuando Supabase todavía no está conectado.
 * Evita que la app explote con un stack trace para quien clona el repo
 * antes de tener el .env.local.
 */
export function DbNotReady({ detail }: { detail?: string }) {
  return (
    <div className="rounded-[24px] bg-chicle/40 px-5 py-4">
      <p className="text-sm font-semibold">Base de datos no conectada</p>
      <p className="mt-2 text-sm text-paper-dim">
        Corré <Cmd>vercel env pull .env.local</Cmd> y después <Cmd>npm run db:push</Cmd>.
        El detalle está en <Cmd>README.md</Cmd>.
      </p>
      {detail && <p className="mt-3 text-xs text-paper-faint">{detail}</p>}
    </div>
  )
}

function Cmd({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-full bg-superficie px-2 py-0.5 text-xs text-carbon">
      {children}
    </code>
  )
}
