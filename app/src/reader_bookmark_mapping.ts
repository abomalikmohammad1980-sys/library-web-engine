export function pageIndexForBookmark(pages: readonly ParentNode[], bookmark: string): number {
  if (!bookmark) return -1
  return pages.findIndex(page => Array.from(page.querySelectorAll<HTMLElement>('[id]')).some(node => node.id === bookmark))
}

