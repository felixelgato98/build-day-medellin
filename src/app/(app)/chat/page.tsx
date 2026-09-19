'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { PageHeader } from '@/components/ui/page-header'
import { ModuleNotice } from '@/components/ui/module-notice'

const SUGERENCIAS = [
  '¿En qué se me fue la plata este mes?',
  '¿Cuánto gasté en restaurantes?',
  '¿Cómo voy de balance?',
  'Dame 3 ideas para gastar menos',
]

export default function ChatPage() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const busy = status === 'submitted' || status === 'streaming'

  function send(text: string) {
    if (!text.trim() || busy) return
    sendMessage({ text })
    setInput('')
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col space-y-8">
      <PageHeader eyebrow="Asistente" title="Chat IA" />

      <ModuleNotice module="Chat IA" folder="src/features/chat/">
        Ya responde y ya tiene contexto del mes. Te toca: darle{' '}
        <span className="tabular text-gold">tools</span> para que consulte la DB
        solo, persistir las conversaciones en{' '}
        <span className="tabular text-gold">chat_conversations</span> /{' '}
        <span className="tabular text-gold">chat_messages</span>, y manejar el
        historial. El modelo se cambia en{' '}
        <span className="tabular text-gold">src/lib/constants.ts</span>.
      </ModuleNotice>

      {/* ----------------------------- Mensajes ---------------------------- */}
      <div className="min-h-[280px] flex-1 space-y-5 border border-rule p-5">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-paper-faint">
              Preguntale lo que sea sobre tus finanzas.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="border border-rule px-3 py-1.5 text-xs text-paper-dim transition-colors hover:border-gold hover:text-gold"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className="space-y-1.5">
            <p className="eyebrow">{m.role === 'user' ? 'Vos' : 'Asistente'}</p>
            <div
              className={
                m.role === 'user'
                  ? 'border-l-2 border-gold pl-3 text-sm text-paper'
                  : 'text-sm leading-relaxed text-paper-dim'
              }
            >
              {m.parts.map((part, i) =>
                part.type === 'text' ? <span key={i}>{part.text}</span> : null,
              )}
            </div>
          </div>
        ))}

        {busy && <p className="eyebrow animate-pulse">Pensando…</p>}
      </div>

      {/* ------------------------------ Input ------------------------------ */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="¿Cuánto gasté en mercado?"
          className="flex-1 border border-rule bg-ink-2 px-3 py-2.5 text-sm text-paper outline-none transition-colors placeholder:text-paper-faint focus:border-gold"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
