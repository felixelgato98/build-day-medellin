import Link from 'next/link'
import { Dock } from '@/components/nav'
import { getCurrentUser } from '@/lib/queries'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const initial = user?.email?.[0]?.toUpperCase() ?? '·'

  return (
    <div className="min-h-screen">
      {/* ----------------------------- Barra superior ------------------------- */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-5 md:px-8">
        <Link href="/" className="headline flex items-center gap-2 text-lg">
          <span aria-hidden className="size-3 rotate-45 rounded-[3px] bg-chicle" />
          Finanzas
        </Link>

        <div className="flex items-center gap-2">
          {user && (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-xs text-paper-dim transition-colors hover:bg-superficie hover:text-carbon"
              >
                Cerrar sesión
              </button>
            </form>
          )}
          <span
            title={user?.email ?? 'Sin sesión'}
            className="headline grid size-9 place-items-center rounded-full bg-lavanda text-sm"
          >
            {initial}
          </span>
        </div>
      </header>

      {/* ------------------------------ Contenido ----------------------------- */}
      {/* pb extra: el dock flota encima y no debe tapar lo último de la página. */}
      <main className="mx-auto max-w-5xl px-5 pb-36 pt-6 md:px-8 md:pt-10">
        {children}
      </main>

      <Dock />
    </div>
  )
}
