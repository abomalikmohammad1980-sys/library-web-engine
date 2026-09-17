/** تحسين الكاش لا يملك حق إسقاط القارئ؛ فشل clone يلغيه فقط ويترك الأصل حيًا. */
export function bestEffortClone<T>(value: T, clone: (source: T) => T, onFailure?: () => void): T | undefined {
  try {
    return clone(value)
  } catch {
    onFailure?.()
    return undefined
  }
}
