import type { Shelf } from './shelf_store'

export interface BulkSelectableBook { id: string; managedSource?: string }

/** نتائج التصفية القابلة للتعديل فقط؛ الأصول المثبتة لا تدخل التحديد الجماعي. */
export function bulkSelectableIds(books: readonly BulkSelectableBook[]): Set<string> {
  return new Set(books.filter(book => book.managedSource !== 'published').map(book => book.id))
}

export function reconcileBulkSelection(selected: Set<string>, visibleIds: ReadonlySet<string>): void {
  for (const id of [...selected]) if (!visibleIds.has(id)) selected.delete(id)
}

export async function bulkDeleteBooks(ids: readonly string[], remove: (id: string) => Promise<void>): Promise<{ deleted: number; failed: string[] }> {
  let deleted = 0
  const failed: string[] = []
  for (const id of ids) { try { await remove(id); deleted += 1 } catch { failed.push(id) } }
  return { deleted, failed }
}

export function bulkShelfUpdate(shelves: readonly Shelf[], selected: ReadonlySet<string>, shelfId: string, action: 'add' | 'remove' | 'move'): Shelf[] {
  return shelves.map(shelf => {
    let bookIds = shelf.bookIds.filter(id => !(action === 'move' && selected.has(id)))
    if (shelf.id === shelfId) bookIds = action === 'remove' ? bookIds.filter(id => !selected.has(id)) : [...new Set([...bookIds, ...selected])]
    return { ...shelf, bookIds }
  })
}
