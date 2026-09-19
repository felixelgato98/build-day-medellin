# Cómo trabajamos

Somos 4 personas en paralelo durante un build day. Estas reglas existen para que
nadie pierda tiempo resolviendo conflictos de merge.

## 1. Tu rama

```bash
git checkout main
git pull
git checkout -b feat/<tu-modulo>    # feat/dashboard, feat/transactions, feat/gmail, feat/chat
```

Nunca trabajes directo sobre `main`. Está protegida.

## 2. Tu territorio

| Escribís libremente | Preguntás antes de tocar |
|---|---|
| `src/features/<tu-modulo>/` | `src/lib/` |
| Tu propia página en `src/app/(app)/` | `src/components/` |
| Tus rutas en `src/app/api/` | `supabase/migrations/` |
| | `src/app/(app)/layout.tsx` |

Si de verdad necesitás cambiar la base: **PR aparte, pequeño, y avisás en el
grupo**. Así los otros 3 lo mergean rápido y siguen.

## 3. Antes de abrir el PR

```bash
npm run typecheck && npm run lint && npm run build
```

Los tres tienen que pasar. El CI corre exactamente eso, así que si te falla
local, te va a fallar allá.

## 4. El PR

```bash
git push -u origin feat/<tu-modulo>
gh pr create --fill
```

- **1 aprobación** de cualquiera del equipo
- **CI en verde**
- Vercel deja un **preview URL** automático en el PR — pegá screenshot si tu
  cambio es visual

Mergeá vos mismo apenas tengas las dos cosas. No esperes a nadie más.

## 5. Si cambiás el schema

Migración nueva **numerada** en `supabase/migrations/` (nunca edites una ya
mergeada — los demás ya la corrieron) **y** actualizá `src/lib/types.ts` en el
**mismo PR**. Avisá al equipo para que corran `npm run db:push`.

## 6. Convenciones de código

- TypeScript estricto. Nada de `any`.
- Server Components por defecto; `'use client'` solo cuando de verdad haga falta.
- Escrituras con **Server Actions** validadas con **zod**.
- Después de escribir en la DB, `revalidatePath()` para que el Dashboard refresque.
- Comentarios en español, explicando **por qué**, no **qué**.
- La plata **siempre** en centavos.

## 7. Cuando termines tu módulo

Borrá el `<ModuleNotice>` de tu página. Es la señal de que ya está listo.
