# Diseño — App de finanzas compartidas · Build Day Medellín

**Fecha:** 2026-09-19
**Estado:** aprobado, base implementada

## Problema

Cuatro personas necesitan trabajar en paralelo, durante un evento de pocas horas,
sobre una app de finanzas que todavía no existe. El riesgo no es técnico: es de
coordinación. Cuatro personas sobre un repo recién nacido se pisan en el primer
commit.

## Decisiones tomadas

| Decisión | Elegido | Alternativa descartada |
|---|---|---|
| Chat interno | Asistente IA sobre las finanzas | Mensajería entre personas |
| Modelo de usuarios | Espacio compartido tipo hogar | Data aislada por usuario |
| Alcance del scaffold | Base + 4 módulos con stubs | Solo base desnuda |
| Base de datos | Supabase vía Vercel Marketplace | Provisionar a mano |
| Autenticación | Email + contraseña, 4 cuentas demo sembradas | Google OAuth |
| Reparto de módulos | El log de transacciones lo hace una persona | El log va en la base |
| Git | Rama por feature + PR con 1 aprobación | Push directo a main |

## Arquitectura

**Stack:** Next.js 16 App Router · TypeScript · Tailwind v4 · Supabase (Postgres
+ Auth + RLS) · Vercel AI Gateway con AI SDK v7.

**Aislamiento por feature folder.** Cada persona escribe solo en
`src/features/<su-modulo>/` y en su propia página. `src/lib/` y
`src/components/` son base congelada: cambios ahí van en PR aparte porque
afectan a los cuatro.

### La decisión que sostiene todo el diseño

Los gastos en efectivo y los de Gmail **no son tablas aparte**. Son filas de
`transactions` con `source = 'cash'` y `source = 'gmail'`.

Consecuencia: el Dashboard consulta **una sola tabla** y le sirven los tres
orígenes sin cambios. Si fueran tablas separadas, cada módulo nuevo obligaría a
modificar el Dashboard — es decir, obligaría a dos personas a tocar el mismo
archivo. El modelo de datos es lo que hace posible el trabajo paralelo.

### Riesgo aceptado y su mitigación

Se eligió que el log de transacciones lo construya **una persona**, lo que en
principio deja a las otras tres esperándola.

Mitigación implementada: el schema completo, los tipos TypeScript, las queries
de lectura compartidas (`src/lib/queries.ts`) y **60 transacciones de seed
realistas en COP** existen desde el commit inicial. Las otras tres personas
construyen contra datos reales desde el minuto cero. La persona del módulo 2
construye la *UI* del log, no la *forma* del dato.

### Reglas de integridad

1. **Plata en centavos, `BIGINT`.** Los floats pierden precisión al sumar y un
   dashboard de finanzas que no cuadra al peso no sirve.
2. **Índice único en `(workspace_id, source, source_ref)`.** Es lo que impide
   que reprocesar el buzón de Gmail duplique gastos. La idempotencia se impone
   en la base de datos, no en el código de quien la consume.
3. **RLS en todas las tablas**, anclado en una sola pregunta: ¿el usuario es
   miembro del workspace? El helper `is_member()` es `SECURITY DEFINER` para
   evitar la recursión infinita de policies sobre `workspace_members`.
4. Las cuentas de Gmail y las conversaciones del chat son **privadas por
   usuario**, aunque el workspace sea compartido. Las transacciones que genera
   Gmail sí son de todos.

## Módulos

| # | Módulo | Estado entregado |
|---|---|---|
| 1 | Dashboard | Versión mínima funcionando contra datos reales |
| 2 | Transacciones + Efectivo | Lectura lista; falta toda la escritura |
| 3 | Gmail / Bancolombia | Sin empezar por decisión explícita; contrato documentado |
| 4 | Chat IA | Streaming funcionando con contexto del mes; faltan tools |

## Verificación

- `npm run typecheck` — pasa
- `npm run build` — pasa; Next 16 reconoce `src/proxy.ts` (`ƒ Proxy (Middleware)`)
- CI en GitHub Actions corre typecheck + lint + build en cada PR, con env vars
  dummy: si un módulo rompe el build sin DB, es porque consulta en import-time.

## Fuera de alcance

- OAuth de Gmail y parseo de Bancolombia (módulo 3, por decisión del equipo)
- Cifrado del `refresh_token` de Gmail — hay TODO marcado en la migración
- Multi-workspace: hoy hay un único hogar con UUID fijo
