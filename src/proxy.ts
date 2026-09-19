import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Next 16 renombró `middleware.ts` a `proxy.ts`. Corre en cada request
 * para mantener viva la sesión de Supabase y bloquear rutas privadas.
 */
export default async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todo menos: estáticos de Next, imágenes optimizadas, favicon y assets.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
