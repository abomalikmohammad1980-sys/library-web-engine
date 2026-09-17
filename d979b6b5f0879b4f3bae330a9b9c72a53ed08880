export type ReadingMode = 'word-pages' | 'flow'
const KEY = 'alkhizana:reading-mode:v1'
export function getReadingMode(): ReadingMode {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'flow' || stored === 'word-pages') return stored
  } catch { /* وضع القراءة يبقى قابلًا للعمل بلا تخزين محلي. */ }
  // المطابقة مع الأصل هي عقد القارئ الافتراضي في كل المقاسات. يبقى النمط
  // الانسيابي خيارًا صريحًا محفوظًا، ولا يُفرض لمجرد أن الشاشة ضيقة.
  return 'word-pages'
}
export function saveReadingMode(mode: ReadingMode): void { try { localStorage.setItem(KEY, mode) } catch { /* preference remains in memory */ } }
export function nextReadingMode(mode: ReadingMode): ReadingMode { return mode === 'word-pages' ? 'flow' : 'word-pages' }
export function readingModeLabel(mode: ReadingMode): string { return mode === 'flow' ? 'عرض صفحات Word' : 'نمط انسيابي' }
