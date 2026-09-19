import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { CHAT_MODEL } from '@/lib/constants'
import {
  getCategories,
  getTransactions,
  getSummary,
  getSpendByCategory,
} from '@/lib/queries'
import { createChatTools } from '@/features/chat/tools'
import { buildSystemPrompt } from '@/features/chat/prompt'
import { describeStreamError } from '@/features/chat/logic'
import {
  insertTransaction,
  getTransactionById,
  deleteTransaction,
} from '@/features/chat/write'

// Fluid Compute: streaming funciona en Node.js sin runtime = 'edge'.
export const maxDuration = 60

/** Cuántas rondas modelo → tool → modelo permitimos antes de forzar respuesta. */
const MAX_STEPS = 8

/**
 * Chat IA sobre las finanzas del workspace.
 *
 * El modelo consulta y escribe en la DB por su cuenta a través de las tools de
 * `src/features/chat/tools.ts`. Acá solo se conectan las tools con las queries
 * reales y se traduce cualquier error a un mensaje legible.
 */
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const tools = createChatTools({
    getCategories,
    getTransactions,
    getSummary,
    getSpendByCategory,
    getTransactionById,
    insertTransaction,
    deleteTransaction,
  })

  const result = streamText({
    model: CHAT_MODEL,
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    onError: ({ error }) => {
      console.error('[chat] stream error', error)
    },
  })

  return result.toUIMessageStreamResponse({
    onError: describeStreamError,
  })
}
