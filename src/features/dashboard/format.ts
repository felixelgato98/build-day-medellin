/**
 * Parte una cifra en "número grande + unidad chica" para los titulares:
 * 381240000 centavos -> { value: "3,8", unit: "millones" }.
 * La cifra exacta se muestra aparte con formatCOP(): el titular es para leer
 * de un vistazo, no para cuadrar al peso.
 */
export function splitAmount(cents: number): {
  value: string
  unit: string
  negative: boolean
} {
  const pesos = Math.abs(cents) / 100
  const negative = cents < 0
  const fmt = (n: number, digits: number) =>
    new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits }).format(n)

  if (pesos >= 1_000_000) {
    // Dos decimales por debajo de 10 M: "3,96" dice mucho más que "4".
    const value = fmt(pesos / 1_000_000, pesos < 10_000_000 ? 2 : 1)
    return { value, unit: value === '1' ? 'millón' : 'millones', negative }
  }
  if (pesos >= 1_000) {
    return { value: fmt(pesos / 1_000, 0), unit: 'mil', negative }
  }
  return { value: fmt(pesos, 0), unit: '', negative }
}

/** Primer nombre legible a partir del correo: "demo1@buildday.co" -> "Demo1". */
export function nameFromEmail(email: string | undefined | null): string | null {
  const local = email?.split('@')[0]?.split(/[._-]/)[0]
  if (!local) return null
  return local.charAt(0).toUpperCase() + local.slice(1)
}
