export const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"] as const
export type Letter = (typeof LETTERS)[number]

/** Blank sheets per folder (deterministic, 3–10) until real content exists. */
export const sheetCount = (l: Letter) => 3 + (((l.charCodeAt(0) - 65) * 7 + 3) % 8)

/** Tab position across the folder top: 0 left, 1 centre, 2 right. */
export const tabSlot = (i: number) => [0, 2, 1][i % 3]

export const pad = (n: number) => String(n).padStart(2, "0")

/** First A–Z letter of a query, ignoring accents ("Émile" → E). */
export function firstLetter(q: string): Letter | null | "invalid" {
  const c = q.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().charAt(0).toUpperCase()
  if (!c) return null
  return (LETTERS as readonly string[]).includes(c) ? (c as Letter) : "invalid"
}

export function buzz(ms = 6) {
  try { navigator.vibrate?.(ms) } catch { /* not supported */ }
}
