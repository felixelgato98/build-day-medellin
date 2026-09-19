# Diseño — Módulo 3: Gmail / Bancolombia

**Fecha:** 2026-09-19 · **Rama:** `feat/gmail`

## Problema

Cargar gastos a mano no escala: la gente lo deja de hacer a los tres días y el
hogar pierde visibilidad justo cuando más la necesita. Bancolombia ya manda un
correo por cada movimiento. Ese buzón es un log de transacciones que nadie está
leyendo.

El módulo convierte ese buzón en filas de `transactions` — automáticamente,
sin duplicar, y sin que los otros tres módulos tengan que enterarse.

## Decisiones tomadas

1. **OAuth propio de Google, no el provider de Supabase.** La identidad con la
   que te logueás no es la del buzón que querés leer: alguien entra como
   `johan@trabajo.com` y recibe los correos del banco en `johan@gmail.com`. Un
   OAuth propio separa las dos cosas. El provider de Supabase las fusiona, y
   además exige habilitar config compartida del proyecto que este módulo no
   controla.

2. **Una conexión por usuario, transacciones para todo el hogar.** El schema ya
   lo modela: `gmail_accounts` es privada por RLS (`user_id = auth.uid()`), pero
   las transacciones que produce las ve todo el workspace. Compartís los gastos,
   no el acceso a tu correo.

3. **Cero dependencias nuevas.** `googleapis` pesa 214 MB porque trae las ~300
   APIs de Google. Acá se usan tres endpoints REST; `fetch` alcanza.

4. **Cero migraciones.** `gmail_accounts` y `gmail_sync_log` ya existen en
   `0001_init.sql` con sus policies en `0002_rls.sql`. El módulo no toca la base
   compartida, así que no necesita coordinación con los otros tres.

5. **Entrada manual como respaldo.** Pegar el texto de un correo ejercita el
   mismo parser sin pasar por Google. Es el escape hatch si Google Cloud se
   atasca durante el evento, y la herramienta de diagnóstico cuando un formato
   nuevo no parsea.

## Arquitectura

Cuatro capas, cada una testeable por separado:

```
google.ts  ──▶  fetcher.ts  ──▶  parser.ts  ──▶  sync.ts
  OAuth          Gmail API      función pura      ingesta
  tokens         RawEmail[]   ParsedTransaction  transactions + log
```

### La costura que sostiene el diseño

Está entre `fetcher` y `parser`. El fetcher devuelve un `RawEmail` genérico y
**el parser nunca conoce la API de Gmail**. Dos consecuencias:

- El parser —que es donde está el valor y donde van a estar los bugs— se testea
  sin red, sin credenciales y sin base de datos.
- Soportar Outlook mañana es escribir otro fetcher. La lógica de parseo no se
  toca.

### El orden de los reconocedores es correctitud

El parser evalúa formatos en una lista ordenada y gana el primero que matchea.
`"Recepción de transferencia"` **contiene** la palabra `"transferencia"`: si el
reconocedor de transferencia saliente se evalúa primero, un ingreso se guarda
como gasto y el balance queda mal por el doble del monto. El caso específico va
antes que el general, y esa no es una preferencia de estilo.

### Reglas de integridad

1. **Todo monto pasa por `parseCOPToCents()`.** El regex aísla el string
   `"45.000"`; la conversión a `4500000` la hace el helper compartido. Un
   `parseFloat("45.000")` devuelve `45` — un error de mil veces que no rompe
   nada visible.
2. **`source_ref` = message-id, siempre.** El índice único
   `(workspace_id, source, source_ref)` es lo que hace que reprocesar el buzón
   sea seguro. La idempotencia vive en el schema, no en el código.
3. **Un formato desconocido devuelve `null`, no lanza.** Una excepción tumbaría
   el sync de 80 correos por culpa de uno raro. El correo crudo queda en `raw` y
   el caso queda contado y visible.
4. **El `state` de OAuth se compara en el callback.** Sin esa comparación un
   atacante puede lograr que la víctima conecte el buzón del atacante a su
   propia cuenta.

## Riesgo aceptado y su mitigación

**`gmail.readonly` es un scope restringido.** Mientras la app esté en modo
*Testing* en Google Cloud, sólo pueden autorizar los usuarios agregados a mano
(hasta 100), y los refresh tokens caducan a los **7 días**. Pasar a producción
abierta exige una revisión de seguridad de Google que toma semanas.

Para el evento alcanza: se agregan equipo y jurado como test users. Queda como
deuda explícita, no como sorpresa.

**Los preview de Vercel no van a funcionar** para el flujo OAuth: Google exige
redirect URIs exactas y cada preview tiene URL distinta. Se prueba en
`localhost` y en el dominio estable de producción.

## Verificación

- `node --import tsx --test src/features/gmail/parser.test.ts` — el parser contra
  fixtures. Los tests se escribieron **sin ver la implementación**, sólo contra
  el contrato.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` — lo mismo que corre el CI.
- Manual: conectar → sincronizar → los movimientos aparecen en `/gmail` y en el
  Dashboard sin que el módulo 1 cambie una línea.

## Fuera de alcance

- Cron de Vercel para sync automático
- Outlook / Microsoft Graph
- Cifrar el `refresh_token` (queda TODO visible, como pide el README)
- Verificación de Google para producción abierta
