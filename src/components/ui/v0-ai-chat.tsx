'use client'

/**
 * Compositor de chat IA estilo v0 (Vercel), adaptado al sistema visual
 * "libro mayor editorial" de la app y a la API de `useChat` del AI SDK.
 *
 * Origen: componente `v0-ai-chat` de 21st.dev / v0. Cambios respecto al
 * original: sin marca ni acciones de v0 (Figma, screenshots…), controlado
 * desde afuera (value/onChange/onSubmit), botón de detener durante el
 * streaming, tokens shadcn en lugar de grises hardcodeados y textos en
 * español. Los chips de acción (`ChatActionButton`) se exportan aparte para
 * que cada pantalla decida cuáles mostrar.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpIcon, CornerDownLeft, Square } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------------ */
/*  Hook: textarea que crece con el contenido                                */
/* ------------------------------------------------------------------------ */

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

export function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      // Encoger primero para medir bien el scrollHeight real.
      textarea.style.height = `${minHeight}px`

      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      )

      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight],
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) textarea.style.height = `${minHeight}px`
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

/* ------------------------------------------------------------------------ */
/*  Compositor                                                               */
/* ------------------------------------------------------------------------ */

export interface AiChatComposerProps {
  value: string
  onChange: (value: string) => void
  /** Se llama con el texto ya recortado. Nunca se llama con texto vacío. */
  onSubmit: (value: string) => void
  /** Si se pasa, el botón de envío se convierte en "detener" mientras `streaming`. */
  onStop?: () => void
  streaming?: boolean
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  minHeight?: number
  maxHeight?: number
  /** Contenido a la izquierda del pie (p. ej. etiqueta del contexto). */
  footer?: React.ReactNode
  className?: string
}

export function AiChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming = false,
  disabled = false,
  placeholder = 'Preguntale lo que sea sobre tu plata…',
  autoFocus = false,
  minHeight = 60,
  maxHeight = 200,
  footer,
  className,
}: AiChatComposerProps) {
  const [focused, setFocused] = useState(false)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  })

  const hasText = value.trim().length > 0
  const canSend = hasText && !disabled && !streaming

  function submit() {
    if (!canSend) return
    onSubmit(value.trim())
    adjustHeight(true)
  }

  // Si el valor se vacía desde afuera (p. ej. tras enviar), volvemos al alto mínimo.
  useEffect(() => {
    if (value === '') adjustHeight(true)
  }, [value, adjustHeight])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      className={cn(
        'relative border bg-ink-2 transition-[border-color,box-shadow] duration-200',
        focused
          ? 'border-gold/70 shadow-[0_0_0_1px_rgba(201,162,39,0.25),0_18px_50px_-24px_rgba(201,162,39,0.35)]'
          : 'border-rule hover:border-paper-faint/60',
        disabled && 'opacity-60',
        className,
      )}
    >
      {/* Filete dorado superior: aparece al enfocar */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-px bg-gold transition-opacity duration-300',
          focused ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div className="overflow-y-auto">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={1}
          aria-label="Mensaje para el asistente"
          className={cn(
            'w-full px-4 py-3',
            'resize-none',
            'border-none bg-transparent',
            'text-sm leading-relaxed text-paper',
            'focus:outline-none',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'placeholder:text-sm placeholder:text-paper-faint',
          )}
          style={{ overflow: 'hidden', minHeight }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-3 pb-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-paper-faint">
          {footer}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              'hidden items-center gap-1 text-[11px] text-paper-faint transition-opacity duration-200 sm:flex',
              focused && hasText ? 'opacity-100' : 'opacity-0',
            )}
          >
            <CornerDownLeft className="h-3 w-3" />
            Enter envía · Shift+Enter salto
          </span>

          {streaming && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Detener respuesta"
              className="flex h-8 w-8 items-center justify-center border border-rule bg-ink-3 text-paper transition-colors hover:border-red hover:text-red"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Enviar"
              className={cn(
                'flex h-8 w-8 items-center justify-center border transition-all duration-200',
                canSend
                  ? 'border-gold bg-gold text-ink shadow-[0_0_0_3px_rgba(201,162,39,0.18)] hover:-translate-y-px hover:shadow-[0_0_0_4px_rgba(201,162,39,0.28)]'
                  : 'border-rule bg-transparent text-paper-faint',
              )}
            >
              <ArrowUpIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/*  Chip de acción                                                           */
/* ------------------------------------------------------------------------ */

export interface ChatActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function ChatActionButton({
  icon,
  label,
  onClick,
  disabled,
  className,
}: ChatActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex items-center gap-2 border border-rule bg-ink-2 px-3.5 py-2 text-left text-paper-dim',
        'transition-all duration-200 hover:-translate-y-px hover:border-gold/70 hover:bg-ink-3 hover:text-paper',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      <span className="text-paper-faint transition-colors group-hover:text-gold">
        {icon}
      </span>
      <span className="text-xs">{label}</span>
    </button>
  )
}
