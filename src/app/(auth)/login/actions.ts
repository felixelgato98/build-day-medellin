'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { error: string | null }

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Escribí tu correo y contraseña.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'No pudimos entrar. Revisá el correo y la contraseña.' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signUp(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (password.length < 6) {
    return { error: 'La contraseña necesita al menos 6 caracteres.' }
  }

  const supabase = await createClient()
  // El trigger on_auth_user_created mete al usuario al workspace compartido,
  // así que apenas entra ya ve la misma data que el resto del equipo.
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: `No pudimos crear la cuenta: ${error.message}` }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
