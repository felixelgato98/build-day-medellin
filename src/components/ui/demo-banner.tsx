import { isDemoMode, isSupabaseConfigured } from '@/lib/demo'

/**
 * Aviso global de que lo que se ve son datos de ejemplo. Vive en el layout
 * para que aparezca en las cuatro páginas y nadie confunda la demo con plata real.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null

  const hint = isSupabaseConfigured()
    ? 'quitá DEMO_DATA del entorno para ver los reales'
    : 'conectá Supabase para ver los reales'

  return (
    <p className="mx-auto w-fit rounded-full bg-chicle/40 px-3 py-1 text-xs">
      Datos de ejemplo · {hint}
    </p>
  )
}
