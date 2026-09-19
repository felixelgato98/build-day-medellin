#!/usr/bin/env node
/**
 * Runner de migraciones y seed. Sin dependencias externas de sistema:
 * no hace falta tener psql instalado.
 *
 *   node scripts/db.mjs push   -> corre supabase/migrations/*.sql en orden
 *   node scripts/db.mjs seed   -> corre supabase/seed.sql
 *   node scripts/db.mjs reset  -> borra el schema public y vuelve a migrar + seed
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import 'dotenv/config'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// La integración de Supabase en Vercel inyecta varias de estas. Probamos en orden.
const CONN =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  process.env.SUPABASE_DB_URL

if (!CONN) {
  console.error(
    '\n✗ No encontré la cadena de conexión.\n' +
      '  Corré primero:  vercel env pull .env.local\n' +
      '  Buscaba alguna de: POSTGRES_URL_NON_POOLING, POSTGRES_URL, DATABASE_URL, SUPABASE_DB_URL\n',
  )
  process.exit(1)
}

const cmd = process.argv[2] ?? 'push'
const client = new pg.Client({
  connectionString: CONN,
  ssl: { rejectUnauthorized: false },
})

async function run(label, sql) {
  process.stdout.write(`  → ${label} … `)
  try {
    await client.query(sql)
    console.log('ok')
  } catch (err) {
    console.log('FALLÓ')
    throw err
  }
}

try {
  await client.connect()
  console.log(`\nConectado. Comando: ${cmd}\n`)

  if (cmd === 'reset') {
    await run('drop schema public', 'drop schema public cascade; create schema public;')
    await run(
      'permisos',
      'grant usage on schema public to anon, authenticated, service_role; ' +
        'grant all on all tables in schema public to anon, authenticated, service_role;',
    )
    await run('drop trigger de auth', 'drop trigger if exists on_auth_user_created on auth.users;')
  }

  if (cmd === 'push' || cmd === 'reset') {
    const dir = join(root, 'supabase', 'migrations')
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      await run(file, readFileSync(join(dir, file), 'utf8'))
    }
  }

  if (cmd === 'seed' || cmd === 'reset') {
    await run('seed.sql', readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8'))
  }

  console.log('\n✓ Listo.\n')
} catch (err) {
  console.error(`\n✗ ${err.message}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
