'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Banknote,
  House,
  Mail,
  PenLine,
  Plus,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/** Pestañas fijas del dock. El "+" del centro abre el menú de agregar. */
const LEFT: DockItem[] = [
  { href: '/', label: 'Inicio', icon: House },
  { href: '/transacciones', label: 'Movimientos', icon: ArrowLeftRight },
]
const RIGHT: DockItem[] = [
  { href: '/gmail', label: 'Bancolombia', icon: Mail },
  { href: '/chat', label: 'Chat IA', icon: Sparkles },
]

/** Las tres formas de meter plata a la app, una por cada origen de datos. */
const ADD_OPTIONS = [
  { href: '/efectivo', label: 'Gasto en efectivo', icon: Banknote, tint: 'bg-vainilla' },
  { href: '/transacciones', label: 'Movimiento manual', icon: PenLine, tint: 'bg-chicle' },
  { href: '/gmail', label: 'Sincronizar Bancolombia', icon: RefreshCw, tint: 'bg-lavanda' },
]

interface DockItem {
  href: string
  label: string
  icon: LucideIcon
}

export function Dock() {
  const pathname = usePathname()
  // Se guarda la ruta donde se abrió el menú: al navegar deja de coincidir y
  // el menú se cierra solo, sin un efecto extra.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const setOpen = (value: boolean | ((v: boolean) => boolean)) =>
    setOpenAt((prev) => {
      const next = typeof value === 'function' ? value(prev === pathname) : value
      return next ? pathname : null
    })
  const rootRef = useRef<HTMLDivElement>(null)

  // Cerrar con Escape o tocando afuera.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenAt(null)
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenAt(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 bottom-4 z-40 mx-auto w-[min(100%-2rem,26rem)]"
    >
      {/* --------------------------- Menú de agregar -------------------------- */}
      <div
        id="dock-add-menu"
        hidden={!open}
        className="rise mb-3 rounded-[28px] bg-carbon p-5 text-crema shadow-xl"
      >
        <p className="headline mb-4 text-center text-lg">Agregar…</p>
        <ul className="space-y-1">
          {ADD_OPTIONS.map((o) => (
            <li key={o.label}>
              <Link
                href={o.href}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 text-sm transition-colors hover:bg-white/10"
              >
                <span
                  className={cn('grid size-9 place-items-center rounded-full text-carbon', o.tint)}
                >
                  <o.icon className="size-4" strokeWidth={2} />
                </span>
                {o.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* -------------------------------- Dock -------------------------------- */}
      <nav
        aria-label="Principal"
        className="relative flex h-16 items-center justify-between rounded-full bg-carbon px-3 text-crema shadow-lg"
      >
        <DockLinks items={LEFT} isActive={isActive} />

        {/* Botón central: sobresale del dock, con un "halo" color fondo que
            recorta la barra como en la referencia. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="dock-add-menu"
          aria-label={open ? 'Cerrar menú de agregar' : 'Agregar movimiento'}
          onClick={() => setOpen((v) => !v)}
          className="-mt-9 grid size-16 shrink-0 place-items-center rounded-full border-[6px] border-crema bg-chicle text-carbon transition-transform hover:scale-105"
        >
          <Plus
            className={cn('size-6 transition-transform duration-300', open && 'rotate-45')}
            strokeWidth={2.25}
          />
        </button>

        <DockLinks items={RIGHT} isActive={isActive} />
      </nav>
    </div>
  )
}

function DockLinks({
  items,
  isActive,
}: {
  items: DockItem[]
  isActive: (href: string) => boolean
}) {
  return (
    <div className="flex flex-1 justify-around">
      {items.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            className={cn(
              'grid size-11 place-items-center rounded-full transition-colors',
              active ? 'bg-crema text-carbon' : 'text-crema/70 hover:text-crema',
            )}
          >
            <item.icon className="size-5" strokeWidth={1.75} />
          </Link>
        )
      })}
    </div>
  )
}
