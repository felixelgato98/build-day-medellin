'use client'

/**
 * Compositor de chat IA estilo v0 (Vercel), adaptado al sistema visual
 * "plata con forma" de la app y a la API de `useChat` del AI SDK.
 *
 * Origen: componente `v0-ai-chat` de 21st.dev / v0. Cambios respecto al
 * original: sin marca ni acciones de v0 (Figma, screenshots…), controlado
 * desde afuera (value/onChange/onSubmit), botón de detener durante el
 * streaming, tokens del tema en lugar de grises hardcodeados y textos en
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
        'relative rounded-[28px] border bg-superficie transition-[border-color,box-shadow] duration-200',
        focused
          ? 'border-carbon shadow-[0_12px_40px_-24px_rgba(28,26,23,0.45)]'
          : 'border-linea hover:border-paper-faint',
        disabled && 'opacity-60',
        className,
      )}
    >
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
            'w-full px-5 pt-4 pb-2',
            'resize-none',
            'rounded-none border-none bg-transparent',
            'text-[15px] leading-relaxed text-carbon',
            'focus:outline-none',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'placeholder:text-sm placeholder:text-paper-faint',
          )}
          style={{ overflow: 'hidden', minHeight }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-3 pb-3 pl-5">
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
            <CornerDownLeft className="size-3" />
            Enter envía · Shift+Enter salto
          </span>

          {streaming && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Detener respuesta"
              className="grid size-10 place-items-center rounded-full border border-linea bg-superficie text-carbon transition-colors hover:border-red hover:text-red"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Enviar"
              className={cn(
                'grid size-10 place-items-center rounded-full transition-all duration-200',
                canSend
                  ? 'bg-carbon text-crema hover:-translate-y-0.5 hover:scale-105'
                  : 'bg-ink-3 text-paper-faint',
              )}
            >
              <ArrowUpIcon className="size-4" strokeWidth={2.25} />
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
  /** Clase de fondo pastel para el icono, p. ej. `bg-vainilla`. */
  tint?: string
  className?: string
}

export function ChatActionButton({
  icon,
  label,
  onClick,
  disabled,
  tint = 'bg-ink-3',
  className,
}: ChatActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex items-center gap-2.5 rounded-full border border-linea bg-superficie py-1.5 pl-1.5 pr-4 text-left text-sm text-carbon',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-carbon',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full text-carbon transition-transform group-hover:scale-105',
          tint,
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}
