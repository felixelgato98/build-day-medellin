'use client'

import { useEffect, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import { Check, Copy, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ChatMessagesProps {
  messages: UIMessage[]
  /** `submitted` = esperando el primer token, `streaming` = llegando texto. */
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  className?: string
}

function textOf(m: UIMessage) {
  return m.parts
    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

/**
 * Hilo de conversación. Hace autoscroll al último mensaje mientras el usuario
 * esté cerca del final (si subió a leer algo viejo, no lo interrumpimos).
 */
export function ChatMessages({ messages, status, className }: ChatMessagesProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  function onScroll() {
    const el = scrollerRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    pinnedRef.current = distance < 80
  }

  const last = messages[messages.length - 1]
  const lastText = last ? textOf(last) : ''

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !pinnedRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, lastText, status])

  const waitingFirstToken = status === 'submitted'

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={cn('overflow-y-auto scroll-smooth px-1 py-3', className)}
    >
      <ol className="space-y-6">
        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          const isLast = i === messages.length - 1
          const isStreamingThis = !isUser && isLast && status === 'streaming'
          return (
            <li key={m.id} className="rise">
              {isUser ? (
                <UserBubble text={textOf(m)} />
              ) : (
                <AssistantBubble text={textOf(m)} streaming={isStreamingThis} />
              )}
            </li>
          )
        })}

        {waitingFirstToken && (
          <li className="rise">
            <AssistantBubble text="" streaming thinking />
          </li>
        )}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[22px] rounded-br-lg bg-carbon px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-crema md:max-w-[75%]">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({
  text,
  streaming,
  thinking = false,
}: {
  text: string
  streaming: boolean
  thinking?: boolean
}) {
  return (
    <div className="group flex gap-3">
      <div
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-chicle text-carbon transition-transform',
          streaming && 'pop',
        )}
      >
        <Sparkles className={cn('size-4', streaming && 'animate-pulse')} strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1 pt-1">
        {thinking ? (
          <ThinkingDots />
        ) : (
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-carbon">
            {text}
            {streaming && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[2px] animate-pulse rounded-sm bg-carbon"
              />
            )}
          </div>
        )}

        {!streaming && text && (
          <div className="mt-2">
            <CopyButton text={text} />
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm text-paper-dim">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-carbon/70"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
      Revisando tus números…
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Sin permisos de portapapeles: no rompemos nada.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copiar respuesta"
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-paper-faint transition-all duration-200 hover:bg-ink-3 hover:text-carbon',
        copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}
