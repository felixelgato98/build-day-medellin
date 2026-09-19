import Link from 'next/link'
import { Nav } from '@/components/nav'
import { getCurrentUser } from '@/lib/queries'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-screen">
      {/* ---------------------------- Barra lateral --------------------------- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-rule md:flex">
        <div className="border-b border-rule px-5 py-6">
          <p className="eyebrow text-gold">Build Day</p>
          <h1 className="headline mt-1 text-xl leading-tight text-paper">
            Finanzas
            <br />
            Medellín
          </h1>
        </div>

        <Nav />

        <div className="mt-auto border-t border-rule px-5 py-4">
          <p className="truncate text-xs text-paper-faint">
            {user?.email ?? 'Sin sesión'}
          </p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="mt-2 text-xs text-paper-dim underline underline-offset-4 transition-colors hover:text-red"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* --------------------------- Contenido -------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Nav móvil */}
        <div className="flex gap-4 overflow-x-auto border-b border-rule px-4 py-3 md:hidden">
          <Link href="/" className="headline shrink-0 text-base text-gold">
            Finanzas
          </Link>
          {['/transacciones', '/efectivo', '/gmail', '/chat'].map((h) => (
            <Link key={h} href={h} className="shrink-0 text-sm text-paper-dim">
              {h.replace('/', '')}
            </Link>
          ))}
        </div>

        <main className="flex-1 px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  )
}
