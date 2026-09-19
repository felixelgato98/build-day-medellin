import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * `cn` estándar de shadcn/ui: combina clases condicionales (clsx) y resuelve
 * conflictos de Tailwind (tailwind-merge), p. ej. `px-4` vs `px-2`.
 *
 * `src/lib/cn.ts` sigue existiendo para el código base; los componentes de
 * `src/components/ui/` generados con shadcn importan desde acá.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
