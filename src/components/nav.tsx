'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { NAV_ITEMS } from '@/lib/constants'

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col">
      {NAV_ITEMS.map((item, i) => {
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group relative border-b border-rule-soft px-5 py-3 text-sm transition-colors',
              active
                ? 'bg-ink-3 text-paper'
                : 'text-paper-dim hover:bg-ink-2 hover:text-paper',
            )}
          >
            {/* Filete dorado que marca la sección activa */}
            <span
              className={cn(
                'absolute left-0 top-0 h-full w-[2px] transition-colors',
                active ? 'bg-gold' : 'bg-transparent',
              )}
            />
            <span className="tabular mr-3 text-[10px] text-paper-faint">
              {String(i + 1).padStart(2, '0')}
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
