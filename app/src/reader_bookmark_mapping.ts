export function normalizeWordBookmark(value: string): string {
  const trimmed = value.trim().replace(/^#/, '')
  try { return decodeURIComponent(trimmed) } catch { return trimmed }
}

export function pageIndexForBookmark(pages: readonly ParentNode[], bookmark: string): number {
  const target = normalizeWordBookmark(bookmark)
  if (!target) return -1
  return pages.findIndex(page => Array.from(page.querySelectorAll<HTMLElement>('[id]'))
    .some(node => normalizeWordBookmark(node.id) === target))
}

/** يبحث داخل القارئ المركب نفسه؛ document.getElementById قد يرى نسخة معاينة
 * أخرى أو يفشل مع الاسم المشفّر، بينما bookmark في Word حساس للاسم الكامل. */
export function renderedBookmarkTarget(root: ParentNode, bookmark: string): HTMLElement | null {
  const target = normalizeWordBookmark(bookmark)
  if (!target) return null
  return Array.from(root.querySelectorAll<HTMLElement>('[id]'))
    .find(node => normalizeWordBookmark(node.id) === target) ?? null
}
