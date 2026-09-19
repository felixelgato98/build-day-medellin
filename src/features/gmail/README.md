# 👤 Módulo 3 — Gmail / Bancolombia

**Tu carpeta:** `src/features/gmail/`
**Tu página:** `src/app/(app)/gmail/page.tsx`
**Tus rutas API:** `src/app/api/gmail/*`
**Rama:** `feat/gmail`

## Estado

**Sin empezar.** Es tuyo completo, de punta a punta.

## Tu encargo

- [ ] OAuth de Google con scope `gmail.readonly`
- [ ] Guardar la cuenta conectada en `gmail_accounts`
- [ ] Leer correos de Bancolombia (`from:bancolombia` + filtros de asunto)
- [ ] **Parsear**: monto, comercio, fecha, tipo (compra / retiro / transferencia / abono)
- [ ] Insertar en `transactions` con `source: 'gmail'`
- [ ] Registrar cada corrida en `gmail_sync_log`
- [ ] Botón "Sincronizar ahora" + idealmente un cron de Vercel

## EL CONTRATO (no lo rompas sin avisar)

| Regla | Por qué |
|---|---|
| Insertás en `transactions` con `source: 'gmail'` | El Dashboard lee de una sola tabla. No crees tablas de movimientos. |
| `source_ref` = message-id del correo | Hay índice único en `(workspace_id, source, source_ref)`. Es lo que impide duplicar gastos al reprocesar. |
| `amount_cents` en centavos | `$45.000` → `4500000`. Usá `parseCOPToCents()`. |
| Guardá el correo crudo en `raw` (jsonb) | Cuando un formato raro no parsee, ahí está la evidencia. |

## Parseo de Bancolombia — lo que vas a encontrar

Bancolombia manda varios formatos. Conviene un parser por tipo y un `switch`
sobre el asunto. Formas típicas:

- `Compra por $45.000 en EXITO ENVIGADO el 19/09/2026 14:32`
- `Retiro por $200.000 en CAJERO ... `
- `Transferencia por $150.000 a ...`
- `Recepción de transferencia por $500.000 de ...`

Sugerencia fuerte: armá **fixtures** con correos reales anonimizados en
`src/features/gmail/__fixtures__/` y testeá el parser contra ellos antes de
tocar la DB. Los regex de montos en formato colombiano (punto como separador de
miles) son la fuente #1 de bugs acá.

## Seguridad

El `refresh_token` **no va en texto plano** en producción. Para el evento pasa,
pero dejá un TODO visible y comentalo en el PR.
