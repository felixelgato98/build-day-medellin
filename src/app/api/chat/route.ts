import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { CHAT_MODEL } from '@/lib/constants'
import { getSummary, getSpendByCategory, currentMonthRange } from '@/lib/queries'
import { formatCOP } from '@/lib/money'

// Fluid Compute: streaming funciona en Node.js sin runtime = 'edge'.
export const maxDuration = 60

/**
 * Chat IA sobre las finanzas del workspace.
 *
 * MÓDULO 4 — versión base funcionando. Hoy le inyecta un resumen del mes al
 * system prompt. El siguiente paso (tuyo) es darle TOOLS reales con `tool()`
 * para que consulte la DB por su cuenta en vez de recibir un resumen fijo:
 * buscar transacciones, filtrar por categoría, comparar meses, etc.
 */
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  let context = 'No se pudo leer la base de datos.'

  try {
    const { from, to } = currentMonthRange()
    const [summary, byCategory] = await Promise.all([
      getSummary(from, to),
      getSpendByCategory(from, to),
    ])

    const top = byCategory
      .slice(0, 8)
      .map((c) => `- ${c.name}: ${formatCOP(c.totalCents)}`)
      .join('\n')

    context = [
      `Ingresos del mes: ${formatCOP(summary.incomeCents)}`,
      `Gastos del mes: ${formatCOP(summary.expenseCents)}`,
      `Balance: ${formatCOP(summary.balanceCents)}`,
      `Movimientos: ${summary.count}`,
      '',
      'Gasto por categoría este mes:',
      top || '(sin gastos)',
    ].join('\n')
  } catch {
    // Seguimos sin contexto: mejor responder que romper el chat.
  }

  const result = streamText({
    model: CHAT_MODEL,
    system: [
      'Sos un asistente de finanzas personales para un hogar colombiano.',
      'Respondés en español, en tono cercano y directo. Sin rodeos.',
      'La moneda es el peso colombiano (COP).',
      'Cuando des cifras, usá formato colombiano y sé preciso.',
      'Si no tenés el dato, decilo claramente en vez de inventarlo.',
      '',
      'Contexto financiero actual del usuario:',
      context,
    ].join('\n'),
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse({
    // Por defecto el SDK manda "An error occurred." al cliente. Acá traducimos
    // los fallos más comunes del Gateway a algo accionable para quien lo ve.
    onError: describeError,
  })
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const body =
    error && typeof error === 'object' && 'responseBody' in error
      ? String((error as { responseBody?: unknown }).responseBody ?? '')
      : ''
  const raw = `${message} ${body}`

  if (/free tier|RestrictedModels|no_providers_available/i.test(raw)) {
    return `Tu plan del AI Gateway no incluye el modelo ${CHAT_MODEL}. Cambiá CHAT_MODEL en src/lib/constants.ts o cargá créditos en Vercel.`
  }
  if (/api key|unauthorized|401|OIDC/i.test(raw)) {
    return 'El AI Gateway rechazó la autenticación. Corré `vercel env pull` o definí AI_GATEWAY_API_KEY.'
  }
  if (/rate limit|429/i.test(raw)) {
    return 'El modelo está saturado (límite de peticiones). Esperá un momento y reintentá.'
  }
  return message.slice(0, 200) || 'Error desconocido al hablar con el modelo.'
}
