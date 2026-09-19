/**
 * Formas orgánicas del sistema visual (estrella, flor, corazón, cruz, gota).
 * Todas en un viewBox 100×100 y rellenas con `currentColor`, así el color se
 * elige con una clase de texto (text-lavanda, text-oliva…).
 */

export type ShapeName = 'star' | 'flower' | 'heart' | 'plus' | 'drop'

/** Polígono de estrella: puntas alternando radio externo e interno. */
function starPoints(points: number, outer: number, inner: number): string {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI * i) / points - Math.PI / 2
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

/** Flor de pétalos suaves: radio que ondula con el ángulo. */
function flowerPath(petals: number, base: number, wave: number): string {
  const steps = 120
  const pts = Array.from({ length: steps }, (_, i) => {
    const a = (2 * Math.PI * i) / steps
    const r = base + wave * Math.cos(petals * a)
    return `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`
  })
  return `M${pts.join(' L')} Z`
}

const STAR = starPoints(9, 44, 31)
const FLOWER = flowerPath(5, 40, 7)
const HEART =
  'M50 90 C22 72 6 56 6 34 C6 18 18 8 32 8 C41 8 47 13 50 21 C53 13 59 8 68 8 C82 8 94 18 94 34 C94 56 78 72 50 90 Z'
const PLUS = '31,8 69,8 69,31 92,31 92,69 69,69 69,92 31,92 31,69 8,69 8,31 31,31'
const DROP =
  'M50 6 C50 6 86 44 86 64 C86 84 70 96 50 96 C30 96 14 84 14 64 C14 44 50 6 50 6 Z'

export function Shape({ name, className }: { name: ShapeName; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      {name === 'star' && (
        // El trazo redondeado del mismo color suaviza las puntas.
        <polygon points={STAR} fill="currentColor" stroke="currentColor" strokeWidth={8} strokeLinejoin="round" />
      )}
      {name === 'flower' && <path d={FLOWER} fill="currentColor" />}
      {name === 'heart' && <path d={HEART} fill="currentColor" />}
      {name === 'plus' && (
        <polygon points={PLUS} fill="currentColor" stroke="currentColor" strokeWidth={10} strokeLinejoin="round" />
      )}
      {name === 'drop' && <path d={DROP} fill="currentColor" />}
    </svg>
  )
}
