#!/usr/bin/env node
/**
 * Crea las 4 cuentas demo del evento, ya confirmadas (sin email de verificación).
 *
 *   node scripts/seed-users.mjs
 *
 * Necesita SUPABASE_SERVICE_ROLE_KEY. Si no la tenés en el .env.local, sacala de
 * Supabase → Project Settings → API → service_role. NUNCA la subas al repo.
 */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    '\n✗ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Corré:  vercel env pull .env.local\n',
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'buildday2026'
const EMAILS = [
  'demo1@buildday.co',
  'demo2@buildday.co',
  'demo3@buildday.co',
  'demo4@buildday.co',
]

console.log('\nCreando cuentas demo…\n')

for (const email of EMAILS) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true, // sin paso de verificación por correo
  })

  if (error && !/already/i.test(error.message)) {
    console.log(`  ✗ ${email} — ${error.message}`)
  } else {
    console.log(`  ✓ ${email}${error ? ' (ya existía)' : ''}`)
  }
}

console.log(`\nContraseña para todas: ${PASSWORD}\n`)
