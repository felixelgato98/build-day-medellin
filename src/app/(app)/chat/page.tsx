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

const SUGERENCIAS = [
  { icon: Wallet, label: '¿En qué se me fue la plata este mes?' },
  { icon: Utensils, label: '¿Cuánto gasté en restaurantes?' },
  { icon: Scale, label: '¿Cómo voy de balance?' },
  { icon: Lightbulb, label: 'Dame 3 ideas para gastar menos' },
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
        <CalendarDays className="h-3.5 w-3.5" />
        Contexto: mes actual
      </span>
      <span className="hidden text-rule sm:inline">·</span>
      <span className="tabular hidden truncate sm:inline">{CHAT_MODEL.split('/').pop()}</span>
    </>
  )

  return (
    // En móvil la página fluye y el compositor queda pegado abajo (sticky).
    // En escritorio ocupa el alto de la ventana y el hilo hace scroll interno.
    <div className="mx-auto flex max-w-3xl flex-col gap-6 md:h-[calc(100dvh-6rem)] md:min-h-[560px]">
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

      {/* =========================== Zona de chat =========================== */}
      <section className="flex min-h-0 flex-1 flex-col">
        {empty ? (
          /* ------------------------ Estado inicial ------------------------ */
          <div className="rise flex flex-1 flex-col justify-center gap-8 py-6 md:py-0">
            <div className="text-center">
              <p className="eyebrow mb-3 flex items-center justify-center gap-2 text-gold">
                <Sparkles className="h-3.5 w-3.5" />
                Asistente financiero
              </p>
              <h2 className="headline text-3xl text-paper md:text-5xl">
                ¿En qué te ayudo con tu plata?
              </h2>
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
              {SUGERENCIAS.map(({ icon: Icon, label }) => (
                <ChatActionButton
                  key={label}
                  icon={<Icon className="h-4 w-4" />}
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
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <p className="eyebrow">
                Conversación ·{' '}
                <span className="tabular text-paper-dim">{messages.length}</span>{' '}
                {messages.length === 1 ? 'mensaje' : 'mensajes'}
              </p>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 text-xs text-paper-dim transition-colors hover:text-gold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Nueva conversación
              </button>
            </div>

            <ChatMessages
              messages={messages}
              status={status}
              className="min-h-[240px] flex-1 md:min-h-0"
            />

            {error && (
              <div className="rise mb-3 flex flex-wrap items-center gap-3 border border-red/50 bg-red/5 px-4 py-3 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red" />
                <p className="min-w-0 flex-1 text-paper-dim">
                  No pude responder.{' '}
                  <span className="text-paper-faint">{error.message}</span>
                </p>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="text-gold underline underline-offset-4 hover:opacity-80"
                  >
                    Reintentar
                  </button>
                  <button
                    type="button"
                    onClick={clearError}
                    className="text-paper-faint hover:text-paper"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 bg-ink pt-3 pb-2 md:static md:pb-0">
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
    </div>
  )
}
