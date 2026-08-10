const KEY = 'alkhizana:recommendation-preferences:v1'

export function dismissedRecommendationIds(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && item.trim()))] : []
  } catch { return [] }
}

export function dismissRecommendation(bookId: string): void {
  if (!bookId.trim()) return
  localStorage.setItem(KEY, JSON.stringify([...new Set([...dismissedRecommendationIds(), bookId])]))
}

export function restoreDismissedRecommendations(): void {
  localStorage.removeItem(KEY)
}

export function saveDismissedRecommendationIds(ids: readonly string[]): void {
  const clean = [...new Set(ids.filter(id => typeof id === 'string' && id.trim()))]
  if (clean.length) localStorage.setItem(KEY, JSON.stringify(clean)); else localStorage.removeItem(KEY)
}
