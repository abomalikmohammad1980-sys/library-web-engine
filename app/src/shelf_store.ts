export interface Shelf {
  id: string
  name: string
  bookIds: string[]
  createdAt: number
}

const KEY = 'alkhizana:shelves:v1'
const DEFAULTS = ['أريد قراءته', 'أقرأه الآن', 'أتممت قراءته']

function read(): Shelf[] {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored !== null) {
      const value = JSON.parse(stored) as Shelf[]
      if (Array.isArray(value)) return value
    }
  } catch { /* نعيد الرفوف الافتراضية عند تلف البيانات المحلية. */ }
  return DEFAULTS.map((name, index) => ({ id: `default-${index + 1}`, name, bookIds: [], createdAt: index }))
}

function write(shelves: Shelf[]): void {
  localStorage.setItem(KEY, JSON.stringify(shelves))
  window.dispatchEvent(new Event('shelves-changed'))
}

export function listShelves(): Shelf[] { return read() }

export function saveShelves(shelves: Shelf[]): void { write(shelves) }

export function createShelf(name: string): Shelf {
  const shelves = read()
  const clean = name.trim()
  if (!clean) throw new Error('اكتب اسم الرف')
  const existing = shelves.find(shelf => shelf.name === clean)
  if (existing) return existing
  const shelf = { id: `shelf-${Date.now().toString(36)}`, name: clean, bookIds: [], createdAt: Date.now() }
  write([...shelves, shelf])
  return shelf
}

export function setBookOnShelf(shelfId: string, bookId: string, included: boolean): void {
  const shelves = read().map(shelf => shelf.id !== shelfId ? shelf : {
    ...shelf,
    bookIds: included ? [...new Set([...shelf.bookIds, bookId])] : shelf.bookIds.filter(id => id !== bookId),
  })
  write(shelves)
}

export function removeShelf(id: string): void {
  write(read().filter(shelf => shelf.id !== id))
}
