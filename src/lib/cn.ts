/** Une clases condicionales sin traer una dependencia extra. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
