/**
 * Manejo de plata. TODO el dinero viaja como BIGINT de centavos.
 *
 * Nunca uses `number` con decimales para plata: 0.1 + 0.2 !== 0.3 en floats,
 * y un dashboard de finanzas que no cuadra al peso no sirve para nada.
 */

/** 45000 centavos -> "$ 450" */
export function formatCOP(cents: number | bigint): string {
  const pesos = Number(cents) / 100
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(pesos)
}

/** Versión compacta para tarjetas del dashboard: "$ 4,5 M" */
export function formatCOPCompact(cents: number | bigint): string {
  const pesos = Number(cents) / 100
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(pesos)
}

/**
 * Convierte lo que el usuario escribe a centavos.
 * Acepta "45.000", "45000", "$45.000", "45.000,50" (formato colombiano).
 */
export function parseCOPToCents(input: string): number | null {
  const cleaned = input
    .replace(/[^\d,.-]/g, '')   // fuera "$", espacios, letras
    .replace(/\./g, '')          // el punto es separador de miles en es-CO
    .replace(',', '.')           // la coma es el decimal

  if (cleaned === '' || cleaned === '-') return null
  const pesos = Number(cleaned)
  if (!Number.isFinite(pesos)) return null

  return Math.round(pesos * 100)
}

/** Centavos -> pesos como número, para gráficas. */
export function centsToPesos(cents: number | bigint): number {
  return Number(cents) / 100
}
