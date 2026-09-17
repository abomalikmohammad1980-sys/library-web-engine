export type QueryUpdates = Record<string, string | number | boolean | null | undefined>

export function hashWithQuery(hash: string, updates: QueryUpdates): string {
  const [path, raw = ''] = hash.split('?')
  const params = new URLSearchParams(raw)
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue
    if (value === null || value === '' || value === false) params.delete(key)
    else params.set(key, String(value))
  }
  const query = params.toString()
  return `${path || '#/'}${query ? `?${query}` : ''}`
}

export function replaceHashQuery(updates: QueryUpdates): void {
  history.replaceState(null, '', hashWithQuery(location.hash, updates))
}

export function currentHashQuery(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '')
}

