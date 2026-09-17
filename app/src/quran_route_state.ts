export type QuranRouteState = { surah: number; ayah: number; page?: number }

function boundedInteger(value: string | null, minimum: number, maximum: number): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined
}

/** Reads only the canonical Quran position parameters; unrelated query state is ignored. */
export function parseQuranRouteState(hash: string): QuranRouteState | undefined {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(query)
  const surah = boundedInteger(params.get('surah'), 1, 114)
  const ayah = boundedInteger(params.get('ayah'), 1, 286)
  if (surah === undefined || ayah === undefined) return undefined
  const page = boundedInteger(params.get('page'), 1, 604)
  return { surah, ayah, ...(page === undefined ? {} : { page }) }
}

export function quranRouteHash(state: QuranRouteState): string {
  const params = new URLSearchParams({ surah: String(state.surah), ayah: String(state.ayah) })
  if (state.page !== undefined) params.set('page', String(state.page))
  return `#/quran?${params.toString()}`
}
