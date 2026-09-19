# 👤 Módulo 4 — Chat IA

**Tu carpeta:** `src/features/chat/`
**Tu página:** `src/app/(app)/chat/page.tsx`
**Tu ruta API:** `src/app/api/chat/route.ts`
**Rama:** `feat/chat`

## Estado

**Ya responde.** Hay streaming funcionando vía Vercel AI Gateway y el system
prompt recibe un resumen del mes. No arrancás de cero.

## Tu encargo

- [ ] **Tools reales** — que el modelo consulte la DB solo, en vez de recibir un
      resumen fijo. Ese es el salto de calidad grande.
- [ ] Persistir conversaciones en `chat_conversations` / `chat_messages`
- [ ] Historial y cambio entre conversaciones
- [ ] Renderizar bien las llamadas a tools en la UI
- [ ] Manejo de errores cuando el Gateway falla

## Tools sugeridas

```ts
import { tool, stepCountIs } from 'ai'
import { z } from 'zod'

const buscarTransacciones = tool({
  description: 'Busca movimientos por categoría, tipo y rango de fechas.',
  inputSchema: z.object({
    categoria: z.string().optional(),
    tipo: z.enum(['income', 'expense']).optional(),
    desde: z.string().optional(),
    hasta: z.string().optional(),
  }),
  execute: async (args) => { /* usá getTransactions() de @/lib/queries */ },
})
```

Acordate de `stopWhen: stepCountIs(n)` para que el modelo pueda encadenar
varias llamadas antes de responder.

## Reglas

- El modelo se configura en `src/lib/constants.ts` (`CHAT_MODEL`).
- Usá el **AI Gateway** con string `"proveedor/modelo"`. No instales
  `@ai-sdk/anthropic` ni ningún SDK por proveedor.
- Streaming funciona en Node.js. **No pongas `runtime = 'edge'`.**
- Las conversaciones son privadas por usuario (ya está en las policies de RLS).
