'use client'

import { useActionState } from 'react'
import { signIn, signUp, type LoginState } from './actions'

const INITIAL: LoginState = { error: null }

const DEMO = [
  { email: 'demo1@buildday.co', password: 'buildday2026' },
  { email: 'demo2@buildday.co', password: 'buildday2026' },
  { email: 'demo3@buildday.co', password: 'buildday2026' },
  { email: 'demo4@buildday.co', password: 'buildday2026' },
]

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, INITIAL)
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, INITIAL)

  const error = state.error ?? signUpState.error

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        {/* --------------------------- Cabecera --------------------------- */}
        <div className="rise mb-10">
          <p className="eyebrow text-gold">Build Day Medellín</p>
          <h1 className="headline mt-3 text-5xl leading-[0.95] text-paper">
            Finanzas
            <span className="block text-paper-faint">compartidas</span>
          </h1>
          <div className="rule-dotted mt-6 h-px" />
        </div>

        {/* ---------------------------- Formulario ------------------------ */}
        <form
          action={action}
          className="rise space-y-4"
          style={{ animationDelay: '80ms' }}
        >
          <div>
            <label htmlFor="email" className="eyebrow mb-2 block">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={DEMO[0].email}
              className="tabular w-full border border-rule bg-ink-2 px-3 py-2.5 text-sm text-paper outline-none transition-colors placeholder:text-paper-faint focus:border-gold"
            />
          </div>

          <div>
            <label htmlFor="password" className="eyebrow mb-2 block">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              defaultValue={DEMO[0].password}
              className="tabular w-full border border-rule bg-ink-2 px-3 py-2.5 text-sm text-paper outline-none transition-colors placeholder:text-paper-faint focus:border-gold"
            />
          </div>

          {error && (
            <p className="border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || signUpPending}
            className="w-full bg-gold px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Entrando…' : 'Entrar'}
          </button>

          <button
            type="submit"
            formAction={signUpAction}
            disabled={pending || signUpPending}
            className="w-full border border-rule px-4 py-3 text-sm text-paper-dim transition-colors hover:border-paper-faint hover:text-paper disabled:opacity-50"
          >
            {signUpPending ? 'Creando…' : 'Crear cuenta nueva'}
          </button>
        </form>

        {/* ---------------------------- Cuentas demo ---------------------- */}
        <div
          className="rise mt-10 border border-dashed border-rule px-4 py-4"
          style={{ animationDelay: '160ms' }}
        >
          <p className="eyebrow mb-3">Cuentas demo del evento</p>
          <ul className="space-y-1">
            {DEMO.map((d) => (
              <li key={d.email} className="tabular text-xs text-paper-faint">
                {d.email}
              </li>
            ))}
          </ul>
          <p className="tabular mt-3 text-xs text-paper-dim">
            contraseña: <span className="text-gold">buildday2026</span>
          </p>
          <p className="mt-3 text-xs leading-relaxed text-paper-faint">
            Todas comparten el mismo espacio. Cualquier cuenta nueva también
            entra automáticamente.
          </p>
        </div>
      </div>
    </div>
  )
}
