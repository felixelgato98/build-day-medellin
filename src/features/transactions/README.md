# 👤 Módulo 2 — Transacciones + Gastos en efectivo

**Tu carpeta:** `src/features/transactions/`
**Tus páginas:** `src/app/(app)/transacciones/page.tsx` y `src/app/(app)/efectivo/page.tsx`
**Rama:** `feat/transactions`

## Estado

La **lectura** ya funciona (las dos páginas listan datos reales). Falta toda la
**escritura**.

## Tu encargo

### Transacciones
- [ ] Formulario de crear movimiento (ingreso o gasto) con Server Actions
- [ ] Editar y borrar
- [ ] Filtros: tipo, categoría, rango de fechas
- [ ] Gestión de categorías (crear/renombrar/color)

### Gastos en efectivo
- [ ] Captura **rápida**: monto + categoría en 2 toques. La fricción mata este feature.
- [ ] Categorías frecuentes de acceso directo
- [ ] Opcional si te alcanza: foto del recibo con Vercel Blob

## Reglas

- **Efectivo NO es una tabla aparte.** Es `transactions` con `source: 'cash'`.
- La plata se guarda en **centavos**. Convertí el input del usuario con
  `parseCOPToCents()` de `@/lib/money`.
- Validá con **zod** antes de insertar.
- Después de escribir, llamá `revalidatePath()` para que el Dashboard se actualice.
- `workspace_id` siempre `WORKSPACE_ID` de `@/lib/constants`.

## Ejemplo de inserción

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { WORKSPACE_ID } from '@/lib/constants'
import { parseCOPToCents } from '@/lib/money'

const supabase = await createClient()
await supabase.from('transactions').insert({
  workspace_id: WORKSPACE_ID,
  kind: 'expense',
  amount_cents: parseCOPToCents('45.000')!,  // -> 4500000
  description: 'Almuerzo',
  source: 'cash',
})
```
