# Finanzas · Build Day Medellín

App web de finanzas compartidas. Un "hogar" donde varias personas ven los mismos
ingresos y gastos: cargados a mano, capturados en efectivo, o leídos
automáticamente de los correos de Bancolombia.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase · Vercel AI Gateway

---

## Arrancar en 5 minutos

```bash
git clone https://github.com/felixelgato98/build-day-medellin.git
cd build-day-medellin
npm install

# Trae las variables de entorno del proyecto de Vercel
npx vercel link --yes --project build-day-medellin
npx vercel env pull .env.local

# Crea el schema, mete datos de ejemplo y crea las cuentas demo
npm run db:setup

npm run dev
```

Abrí http://localhost:3000 y entrá con:

| Correo | Contraseña |
|---|---|
| `demo1@buildday.co` … `demo4@buildday.co` | `buildday2026` |

Cualquier cuenta nueva que crees también entra automáticamente al mismo espacio.

---

## Quién hace qué

| # | Módulo | Carpeta | Rama | Estado inicial |
|---|---|---|---|---|
| 1 | **Dashboard** | `src/features/dashboard/` | `feat/dashboard` | Versión mínima ya leyendo datos reales |
| 2 | **Transacciones + Efectivo** | `src/features/transactions/` | `feat/transactions` | Lectura lista, falta toda la escritura |
| 3 | **Gmail / Bancolombia** | `src/features/gmail/` | `feat/gmail` | Sin empezar |
| 4 | **Chat IA** | `src/features/chat/` | `feat/chat` | Ya responde con streaming |

**Cada carpeta tiene su propio `README.md` con el encargo detallado. Leé el tuyo.**

---

## La regla que evita que nos pisemos

> **Escribí solo dentro de la carpeta de tu módulo y en tu propia página.**

```
src/
├── app/
│   ├── (auth)/login/          🔒 base
│   ├── (app)/layout.tsx       🔒 base — shell + navegación
│   ├── (app)/page.tsx         👤1 Dashboard
│   ├── (app)/transacciones/   👤2
│   ├── (app)/efectivo/        👤2
│   ├── (app)/gmail/           👤3
│   ├── (app)/chat/            👤4
│   └── api/chat/route.ts      👤4
├── features/
│   ├── dashboard/             👤1   ← tu código va acá
│   ├── transactions/          👤2
│   ├── gmail/                 👤3
│   └── chat/                  👤4
├── components/                🔒 base — kit compartido
└── lib/                       🔒 base — supabase, tipos, money, queries
```

🔒 = base congelada. Si necesitás cambiar algo de ahí, **avisá al equipo y hacelo
en un PR aparte**, porque afecta a los 4.

---

## Modelo de datos

Una sola tabla de movimientos. **Efectivo y Gmail NO son tablas aparte** — son
filas de `transactions` con `source` distinto:

| `source` | Quién la escribe |
|---|---|
| `manual` | Carga manual normal |
| `cash` | Gastos en efectivo (módulo 2) |
| `gmail` | Correos de Bancolombia (módulo 3) |

Gracias a eso el Dashboard consulta **una sola tabla** y le sirven los tres
orígenes sin tocar nada.

### Dos reglas de oro

1. **La plata va en centavos, en `BIGINT`.** `$45.000` se guarda como `4500000`.
   Nunca uses floats: `0.1 + 0.2 !== 0.3` y un dashboard de finanzas que no
   cuadra al peso no sirve. Convertí con `parseCOPToCents()` y mostrá con
   `formatCOP()`, ambos en `@/lib/money`.

2. **`source_ref` garantiza idempotencia.** Hay un índice único sobre
   `(workspace_id, source, source_ref)`. Por eso reprocesar el buzón de Gmail no
   puede duplicar gastos.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run lint` | ESLint |
| `npm run build` | Build de producción |
| `npm run db:push` | Aplica las migraciones |
| `npm run db:seed` | Mete 60 transacciones de ejemplo |
| `npm run db:users` | Crea las 4 cuentas demo |
| `npm run db:setup` | Los tres anteriores de una |
| `npm run db:reset` | ⚠️ Borra todo y reconstruye |

---

## Variables de entorno

Salen solas con `vercel env pull .env.local`. Ver `.env.example` para el detalle.

La única que puede faltar es `SUPABASE_SERVICE_ROLE_KEY` (solo la necesita
`npm run db:users`). Está en Supabase → Project Settings → API.

---

## Cómo trabajamos

Ver [`CONTRIBUTING.md`](./CONTRIBUTING.md). Resumen: rama por feature, PR con 1
aprobación, CI en verde antes de mergear.
