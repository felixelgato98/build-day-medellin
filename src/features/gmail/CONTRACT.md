# Contrato de interfaces — módulo Gmail / Bancolombia

Este archivo existe porque el módulo se construyó con varias piezas escritas en
paralelo, cada una sin ver el código de las otras. Lo único que compartieron fue
este contrato. **Si cambiás una firma de acá, rompés a las demás piezas.**

Los tipos viven en [`types.ts`](./types.ts). Nada de lo que sigue los redefine.

---

## Variables de entorno

```
GOOGLE_CLIENT_ID       # ID de cliente OAuth (aplicación web)
GOOGLE_CLIENT_SECRET   # secreto del cliente
```

Ninguna pieza las lee directo salvo `google.ts`. Si falta alguna, `google.ts`
lanza un error con mensaje accionable en español (no un `undefined` silencioso).

---

## `google.ts` — el baile de OAuth

Única pieza que conoce los endpoints de OAuth de Google. Sin SDK: `fetch` pelado.

```ts
/** URL a la que se redirige al usuario para que autorice. */
export function buildConsentUrl(opts: { redirectUri: string; state: string }): string

/** Intercambia el `code` del callback por tokens. Lanza si Google responde error. */
export function exchangeCodeForTokens(opts: {
  code: string
  redirectUri: string
}): Promise<GoogleTokens>

/** Canjea un refresh_token por un access_token nuevo. Lanza si fue revocado. */
export function refreshAccessToken(refreshToken: string): Promise<GoogleTokens>

/** Correo de la cuenta que acaba de autorizar. Usa el endpoint userinfo. */
export function fetchGoogleEmail(accessToken: string): Promise<string>
```

**Requisitos de la URL de consentimiento:** `scope=https://www.googleapis.com/auth/gmail.readonly`,
`access_type=offline` y `prompt=consent`. Sin esos dos últimos Google **no manda
`refresh_token`** y la sincronización sólo funciona una hora.

---

## `fetcher.ts` — la API de Gmail

Única pieza que sabe que Gmail existe. Convierte mensajes de Gmail en `RawEmail`.

```ts
/** Query por defecto contra el buzón. Exportada para poder testearla y ajustarla. */
export const BANCOLOMBIA_QUERY: string

export function fetchBancolombiaEmails(opts: {
  accessToken: string
  /** Tope de correos a traer en una corrida. Por defecto 50. */
  max?: number
  /** Query de Gmail. Por defecto BANCOLOMBIA_QUERY. */
  query?: string
}): Promise<RawEmail[]>
```

**Obligaciones:**

- Decodificar el cuerpo de **base64url** (`-` y `_` en vez de `+` y `/`).
- Preferir la parte `text/plain`; si sólo hay `text/html`, quitar las etiquetas.
- `id` del `RawEmail` = el `id` del mensaje de Gmail (no el `threadId`).
- Reintentar con backoff ante 429 y 5xx; propagar cualquier otro error.

---

## `parser.ts` — el corazón, función pura

Cero I/O: ni red, ni base de datos, ni variables de entorno. Por eso se testea
sin credenciales.

```ts
/** Devuelve null si ningún reconocedor supo leer el correo. NUNCA lanza. */
export function parseBancolombiaEmail(email: RawEmail): ParsedTransaction | null

/** Expuesto para los tests y para diagnosticar qué reconocedor ganó. */
export function detectarMovimiento(texto: string): MovimientoBancolombia | null
```

**Formatos, en este orden exacto de evaluación:**

| # | Formato | `movimiento` | `kind` | `merchant` |
|---|---|---|---|---|
| 1 | `Recepción de transferencia por $X de FULANO` | `transferencia_entrante` | `income` | FULANO |
| 2 | `Pago recibido por $X de FULANO` | `pago_recibido` | `income` | FULANO |
| 3 | `Compra por $X en COMERCIO` | `compra` | `expense` | COMERCIO |
| 4 | `Retiro por $X en CAJERO Y` | `retiro` | `expense` | CAJERO Y |
| 5 | `Transferencia por $X a FULANO` | `transferencia_saliente` | `expense` | FULANO |

**El orden es correctitud, no estética.** `"Recepción de transferencia"` contiene
la palabra `"transferencia"`: si evaluás el formato 5 antes que el 1, un ingreso
de $500.000 se guarda como gasto y el balance queda mal por el doble del monto.

**Reglas no negociables:**

- El monto se extrae como string (`"45.000"`) y se convierte **siempre** con
  `parseCOPToCents()` de `@/lib/money`. Prohibido `parseFloat` sobre el monto:
  `$45.000` se convertiría en `45`, un error de mil veces que no rompe nada
  visible.
- `occurred_at`: si el correo trae fecha (`19/09/2026 14:32`, día/mes/año), usala;
  si no, caé a `email.receivedAt`.
- `source_ref` = `email.id`, siempre.
- Un formato desconocido devuelve `null`. Una excepción tumbaría el sync entero
  de 80 correos por culpa de uno raro.

---

## `sync.ts` — orquestación e ingesta

```ts
/** Corre una sincronización completa para una cuenta conectada. */
export function syncGmailAccount(opts: {
  accountId: string
  max?: number
}): Promise<SyncResult>

/** Inserta transacciones ya parseadas. Reutilizada por la entrada manual. */
export function ingestParsed(
  parsed: ParsedTransaction[],
): Promise<{ saved: number; duplicados: number }>
```

**Obligaciones:**

- Insertar en `transactions` con `source: 'gmail'`, `workspace_id: WORKSPACE_ID`
  de `@/lib/constants`, y el correo crudo en `raw`.
- Usar `upsert(..., { onConflict: 'workspace_id,source,source_ref', ignoreDuplicates: true })`
  y **contar** los duplicados en vez de tratarlos como error: son la idempotencia
  funcionando.
- Abrir una fila en `gmail_sync_log` al empezar y cerrarla al terminar con
  `finished_at`, `messages_seen`, `messages_saved` y `error`.
- Actualizar `gmail_accounts.last_sync_at`.
- Si `refreshAccessToken` falla, escribir el error en el log y devolver un
  `SyncResult` con `error`, sin lanzar.

---

## `actions.ts` — Server Actions

```ts
'use server'

/** Corre el sync de la cuenta del usuario y revalida las vistas afectadas. */
export function sincronizarAhora(): Promise<SyncResult>

/** Borra la cuenta conectada del usuario. No borra las transacciones ya creadas. */
export function desconectarCuenta(): Promise<void>

/** Escape hatch y herramienta de debug: parsea texto pegado a mano. */
export function procesarCorreoPegado(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; mensaje: string }>
```

**Obligaciones:**

- Validar toda entrada con **zod** antes de usarla.
- Después de escribir, `revalidatePath('/gmail')` **y** `revalidatePath('/')`
  — si no, el Dashboard del módulo 1 muestra datos viejos.
- `procesarCorreoPegado` arma un `RawEmail` sintético con
  `id: 'pegado:<hash estable del texto>'` para que pegar dos veces el mismo
  correo no duplique el gasto.

---

## Rutas de OAuth

### `src/app/api/gmail/auth/route.ts`

`GET` → genera un `state` aleatorio, lo guarda en una cookie `httpOnly`
(`gmail_oauth_state`, `sameSite: 'lax'`, 10 min) y redirige a `buildConsentUrl()`.

### `src/app/api/gmail/callback/route.ts`

`GET` → compara el `state` del query con el de la cookie y **aborta si no
coinciden** (es la defensa anti-CSRF: sin eso, un atacante puede hacer que
conectes *su* buzón a *tu* cuenta). Después: `exchangeCodeForTokens`,
`fetchGoogleEmail`, upsert en `gmail_accounts` con `user_id` del usuario logueado
y `workspace_id: WORKSPACE_ID`, y redirect a `/gmail`.

Errores → redirect a `/gmail?error=<código>`, nunca un 500 crudo en la cara.

El `redirectUri` se arma como `new URL('/api/gmail/callback', origin)` y debe ser
**idéntico** en las dos rutas: Google compara string contra string.

---

## Componentes — props

Todos en `src/features/gmail/components/`. Usan el kit de `@/components/ui/`
(`Card`, `CardHeader`, `CardBody`, `EmptyState`, `StatCard`) y las clases del
tema (`text-paper`, `text-paper-dim`, `text-gold`, `eyebrow`, `tabular`).

```ts
// connect-card.tsx  — Server Component
export function ConnectCard(props: {
  cuenta: GmailAccount | null
  error?: string        // el ?error= del callback, ya traducido a español
}): ReactNode

// sync-button.tsx  — 'use client', usa useActionState/useFormStatus
export function SyncButton(props: { disabled?: boolean }): ReactNode

// sync-log.tsx  — Server Component
export function SyncLog(props: { entradas: GmailSyncLog[] }): ReactNode

// paste-email-form.tsx  — 'use client'
export function PasteEmailForm(): ReactNode
```

---

## `src/app/(app)/gmail/page.tsx`

Server Component, `export const dynamic = 'force-dynamic'`. Compone:
`PageHeader` → `ConnectCard` → `SyncButton` → resumen del último sync →
`PasteEmailForm` → `SyncLog` → `TransactionList` con `source: 'gmail'`.

Mantiene el manejo de error con `<DbNotReady>` que ya tenía.
**Borra el `<ModuleNotice>`**: es la señal acordada de que el módulo está listo.

---

## Fuera del contrato — no lo toques

`src/lib/`, `src/components/`, `supabase/migrations/`, `package.json`,
`src/app/(app)/layout.tsx`. Son base compartida por los 4 módulos.
**Cero dependencias nuevas:** la API de Gmail son tres endpoints REST y `fetch`
alcanza.
