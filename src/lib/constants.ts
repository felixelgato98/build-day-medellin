/**
 * Constantes compartidas. Base congelada — cambios acá afectan a los 4 módulos,
 * así que se discuten en el PR antes de mergear.
 */

/** El "hogar" compartido del Build Day. Coincide con supabase/migrations/0003. */
export const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

/** Modelo del chat IA, vía Vercel AI Gateway (string "proveedor/modelo"). */
export const CHAT_MODEL = 'anthropic/claude-sonnet-5'

export const NAV_ITEMS = [
  { href: '/',              label: 'Dashboard',    module: 'dashboard'    },
  { href: '/transacciones', label: 'Transacciones', module: 'transactions' },
  { href: '/efectivo',      label: 'Efectivo',     module: 'transactions' },
  { href: '/gmail',         label: 'Gmail',        module: 'gmail'        },
  { href: '/chat',          label: 'Chat IA',      module: 'chat'         },
] as const
