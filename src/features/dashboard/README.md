# 👤 Módulo 1 — Dashboard (Home)

**Tu carpeta:** `src/features/dashboard/`
**Tu página:** `src/app/(app)/page.tsx`
**Rama:** `feat/dashboard`

## Estado

Ya hay una versión mínima funcionando que lee datos reales: 3 tarjetas de
cifras, gasto por categoría y últimos movimientos. **No arrancás de cero.**

## Tu encargo

- [ ] Gráfica de evolución mensual (ingresos vs gastos, últimos 6 meses)
- [ ] Comparativo contra el mes anterior (↑12% en restaurantes, etc.)
- [ ] Filtro por rango de fechas
- [ ] Desglose efectivo vs Bancolombia (el campo `source` ya lo distingue)
- [ ] Estado vacío decente para cuando no hay datos

## Lo que ya tenés listo

```ts
import { getSummary, getSpendByCategory, getTransactions, currentMonthRange } from '@/lib/queries'
import { formatCOP, formatCOPCompact, centsToPesos } from '@/lib/money'
import { StatCard } from '@/components/ui/stat-card'
```

## Reglas

- La plata viene en **centavos**. Formateá siempre con `formatCOP()`.
- Para gráficas usá `centsToPesos()`.
- Si necesitás una query nueva y genérica, va en `src/lib/queries.ts` en un PR
  aparte y avisás al equipo. Si es solo tuya, va acá.
- Cuando termines, borrá el `<ModuleNotice>` de tu página.
