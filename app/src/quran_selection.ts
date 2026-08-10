export interface QuranSelectionRect { left: number; right: number; top: number; bottom: number }

/** Prefer the transparent word physically under the pointer. Adjacent ayah
 * boxes overlap on some printed pages, so DOM order is unsafe across lines. */
export function quranWordIndexAtPoint(
  words: readonly HTMLElement[], x: number, y: number,
  elementsAtPoint: (x: number, y: number) => readonly Element[] = (px, py) => document.elementsFromPoint?.(px, py) ?? [],
): number {
  for (const element of elementsAtPoint(x, y)) {
    const word = element.closest<HTMLElement>('.quran-copy-overlay__word')
    const exact = word ? words.indexOf(word) : -1
    if (exact >= 0) return exact
  }
  let best = 0, bestScore = Number.POSITIVE_INFINITY
  words.forEach((candidate, index) => {
    const rect: QuranSelectionRect = candidate.getBoundingClientRect()
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
    const score = dx * dx + dy * dy
    if (score < bestScore) { best = index; bestScore = score }
  })
  return best
}
