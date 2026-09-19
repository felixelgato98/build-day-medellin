'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  AlertTriangle,
  CalendarDays,
  Lightbulb,
  RotateCcw,
  Scale,
  Sparkles,
  Utensils,
  Wallet,
} from 'lucide-react'

import { PageHeader } from '@/components/ui/page-header'
import { ModuleNotice } from '@/components/ui/module-notice'
import { AiChatComposer, ChatActionButton } from '@/components/ui/v0-ai-chat'
import { ChatMessages } from '@/features/chat/components/chat-messages'
import { CHAT_MODEL } from '@/lib/constants'

/** Cada sugerencia lleva el pastel del dato que toca, como en el dock. */
const SUGERENCIAS = [
  { icon: Wallet, tint: 'bg-vainilla', label: '¿En qué se me fue la plata este mes?' },
  { icon: Utensils, tint: 'bg-chicle', label: '¿Cuánto gasté en restaurantes?' },
  { icon: Scale, tint: 'bg-oliva', label: '¿Cómo voy de balance?' },
  { icon: Lightbulb, tint: 'bg-lavanda', label: 'Dame 3 ideas para gastar menos' },
]

export default function ChatPage() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, stop, error, regenerate, clearError, setMessages } =
    useChat({
      transport: new DefaultChatTransport({ api: '/api/chat' }),
    })

  const busy = status === 'submitted' || status === 'streaming'
  const empty = messages.length === 0

  function send(text: string) {
    const clean = text.trim()
    if (!clean || busy) return
    sendMessage({ text: clean })
    setInput('')
  }

  function reset() {
    if (busy) stop()
    clearError()
    setMessages([])
    setInput('')
  }

  const contextTag = (
    <>
      <span className="flex items-center gap-1.5">
        <CalendarDays className="size-3.5" />
        Contexto: mes actual
      </span>
      <span className="hidden text-linea sm:inline">·</span>
      <span className="tabular hidden truncate sm:inline">{CHAT_MODEL.split('/').pop()}</span>
    </>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Asistente" title="Chat IA" />

      {/* =========================== Zona de chat ===========================
          En móvil la página fluye y el compositor queda pegado encima del dock.
          En escritorio ocupa el alto disponible y el hilo hace scroll interno. */}
      <section className="flex flex-col md:h-[calc(100dvh-21rem)] md:min-h-[520px]">
        {empty ? (
          /* ------------------------ Estado inicial ------------------------ */
          <div className="rise flex flex-1 flex-col justify-center gap-8 py-4 md:py-0">
            <div className="text-center">
              <span className="pop mx-auto mb-4 grid size-12 place-items-center rounded-full bg-chicle text-carbon">
                <Sparkles className="size-5" strokeWidth={2} />
              </span>
              <h2 className="headline text-3xl md:text-4xl">¿En qué te ayudo con tu plata?</h2>
              <p className="mt-3 text-sm text-paper-dim">
                Conoce tus ingresos, gastos y balance del mes. Preguntá en tus palabras.
              </p>
            </div>

            <AiChatComposer
              value={input}
              onChange={setInput}
              onSubmit={send}
              disabled={busy}
              autoFocus
              footer={contextTag}
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              {SUGERENCIAS.map(({ icon: Icon, tint, label }) => (
                <ChatActionButton
                  key={label}
                  icon={<Icon className="size-4" strokeWidth={2} />}
                  tint={tint}
                  label={label}
                  onClick={() => send(label)}
                  disabled={busy}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ------------------------- Conversación ------------------------- */
          <>
            <div className="flex items-center justify-between pb-2">
              <p className="eyebrow">
                Conversación · <span className="tabular">{messages.length}</span>{' '}
                {messages.length === 1 ? 'mensaje' : 'mensajes'}
              </p>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-paper-dim transition-colors hover:bg-superficie hover:text-carbon"
              >
                <RotateCcw className="size-3.5" />
                Nueva conversación
              </button>
            </div>

            <ChatMessages
              messages={messages}
              status={status}
              className="min-h-[240px] flex-1 md:min-h-0"
            />

            {error && (
              <div className="rise mb-3 flex flex-wrap items-center gap-3 rounded-[20px] bg-red/10 px-4 py-3 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-red" />
                <p className="min-w-0 flex-1 text-carbon">
                  No pude responder.{' '}
                  <span className="text-paper-dim">{error.message}</span>
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="rounded-full bg-carbon px-3 py-1.5 font-medium text-crema transition-transform hover:-translate-y-0.5"
                  >
                    Reintentar
                  </button>
                  <button
                    type="button"
                    onClick={clearError}
                    className="rounded-full px-3 py-1.5 text-paper-dim hover:text-carbon"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* bottom-32: deja libre el dock flotante (64px + margen + botón "+"). */}
            <div className="sticky bottom-32 bg-crema pt-3 pb-1 md:static md:pb-0">
              <AiChatComposer
                value={input}
                onChange={setInput}
                onSubmit={send}
                onStop={stop}
                streaming={busy}
                placeholder="Seguí preguntando…"
                footer={contextTag}
              />
            </div>
          </>
        )}
      </section>

      <ModuleNotice module="Chat IA" folder="src/features/chat/">
        Ya responde y ya tiene contexto del mes. Te toca: darle{' '}
        <span className="tabular text-gold">tools</span> para que consulte la DB
        solo, persistir las conversaciones en{' '}
        <span className="tabular text-gold">chat_conversations</span> /{' '}
        <span className="tabular text-gold">chat_messages</span>, y manejar el
        historial. El modelo se cambia en{' '}
        <span className="tabular text-gold">src/lib/constants.ts</span>.
      </ModuleNotice>
    </div>
  )
}
