import {captureReadingIdentity,readingStorageKey} from './reading_identity_scope'
export type ShelfColor = 'sand' | 'olive' | 'blue' | 'rose'
export type ShelfPrivacy = 'private' | 'shared'

export interface Shelf {
  id: string
  name: string
  bookIds: string[]
  createdAt: number
  /** حقول v2 اختيارية نوعيًا كي تبقى ملفات التصدير القديمة قابلة للاستيراد. */
  color?: ShelfColor
  privacy?: ShelfPrivacy
  system?: boolean
  order?: number
}

const KEY = 'alkhizana:shelves:v2'
const LEGACY_KEY = 'alkhizana:shelves:v1'
const COLORS = new Set<ShelfColor>(['sand', 'olive', 'blue', 'rose'])
const SYSTEM_SHELVES = ['أريد قراءته', 'أقرأه الآن', 'أتممت قراءته'] as const

function systemShelves(): Shelf[] {
  return SYSTEM_SHELVES.map((name, index) => ({
    id: `default-${index + 1}`, name, bookIds: [], createdAt: index,
    color: index === 0 ? 'sand' : index === 1 ? 'olive' : 'blue',
    privacy: 'private', system: true, order: index,
  }))
}

function normalizeShelf(value: unknown, index: number): Shelf | undefined {
  if (!value || typeof value !== 'object') return undefined
  const item = value as Partial<Shelf>
  if (typeof item.id !== 'string' || !item.id.trim() || typeof item.name !== 'string' || !item.name.trim()) return undefined
  const systemIndex = /^default-([1-3])$/.exec(item.id)?.[1]
  const system = Boolean(systemIndex)
  const color = COLORS.has(item.color as ShelfColor) ? item.color as ShelfColor : 'sand'
  return {
    id: item.id, name: system ? SYSTEM_SHELVES[Number(systemIndex) - 1]! : item.name.trim(),
    bookIds: Array.isArray(item.bookIds) ? [...new Set(item.bookIds.filter((id): id is string => typeof id === 'string' && Boolean(id)))] : [],
    createdAt: Number.isFinite(item.createdAt) ? Math.max(0, Number(item.createdAt)) : Date.now(),
    color, privacy: item.privacy === 'shared' ? 'shared' : 'private', system,
    order: Number.isFinite(item.order) ? Number(item.order) : index,
  }
}

function normalizeShelves(value: unknown): Shelf[] {
  const items = Array.isArray(value) ? value.map(normalizeShelf).filter((item): item is Shelf => Boolean(item)) : []
  const byId = new Map(items.map(item => [item.id, item]))
  const systems = systemShelves().map(fallback => {
    const saved = byId.get(fallback.id)
    return saved ? { ...fallback, bookIds: saved.bookIds, color: saved.color ?? fallback.color ?? 'sand' } : fallback
  })
  const personal = items.filter(item => !item.system && !/^default-[1-3]$/.test(item.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt)
    .map((item, index) => ({ ...item, system: false, order: systems.length + index }))
  return [...systems, ...personal]
}

function read(): Shelf[] {
  try {
    const current = localStorage.getItem(readingStorageKey(KEY))
    if (current !== null) return normalizeShelves(JSON.parse(current))
    const legacy = localStorage.getItem(readingStorageKey(LEGACY_KEY))
    const migrated = normalizeShelves(legacy === null ? [] : JSON.parse(legacy))
    localStorage.setItem(readingStorageKey(KEY), JSON.stringify(migrated))
    return migrated
  } catch { return systemShelves() }
}

function write(shelves: readonly Shelf[]): void {
  localStorage.setItem(readingStorageKey(KEY), JSON.stringify(normalizeShelves(shelves)))
  window.dispatchEvent(new Event('shelves-changed'))
}

export function listShelves(): Shelf[] { return read() }
export function saveShelves(shelves: Shelf[]): void { write(shelves) }

/** Capture before opening an editor or awaiting data; old editors never write to a new account. */
export function captureShelfStore(){
  const identity=captureReadingIdentity()
  return {
    isCurrent:identity.isCurrent,
    list:():Shelf[]=>identity.isCurrent()?listShelves():[],
    create:(name:string):Shelf|undefined=>identity.isCurrent()?createShelf(name):undefined,
    remove:(id:string):void=>{if(identity.isCurrent())removeShelf(id)},
    setBook:(id:string,bookId:string,included:boolean):void=>{if(identity.isCurrent())setBookOnShelf(id,bookId,included)},
    save:(shelves:Shelf[]):boolean=>{if(!identity.isCurrent())return false;saveShelves(shelves);return true},
  }
}

export function createShelf(name: string): Shelf {
  const shelves = read(), clean = name.trim()
  if (!clean) throw new Error('اكتب اسم الرف')
  const existing = shelves.find(shelf => shelf.name === clean)
  if (existing) return existing
  let id = `shelf-${Date.now().toString(36)}`
  while (shelves.some(shelf => shelf.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`
  const shelf: Shelf = { id, name: clean, bookIds: [], createdAt: Date.now(), color: 'sand', privacy: 'private', system: false, order: shelves.length }
  write([...shelves, shelf])
  return shelf
}

export function setBookOnShelf(shelfId: string, bookId: string, included: boolean): void {
  write(read().map(shelf => shelf.id !== shelfId ? shelf : {
    ...shelf, bookIds: included ? [...new Set([...shelf.bookIds, bookId])] : shelf.bookIds.filter(id => id !== bookId),
  }))
}

export function updateShelfPresentation(id: string, patch: { name?: string; color?: ShelfColor; privacy?: ShelfPrivacy }): void {
  write(read().map(shelf => {
    if (shelf.id !== id) return shelf
    const name = shelf.system ? shelf.name : patch.name?.trim() || shelf.name
    return {
      ...shelf,
      name,
      // الرفوف القديمة قد لا تحمل حقول العرض الاختيارية. لا نُمرّر
      // `undefined` صراحةً إلى نموذج Shelf؛ بل نطبّق قيم المخزن المعتمدة.
      color: patch.color && COLORS.has(patch.color) ? patch.color : shelf.color ?? 'sand',
      privacy: patch.privacy ?? shelf.privacy ?? 'private',
    }
  }))
}

/** رفوف النظام ثابتة أولًا، ويُعاد ترتيب الرفوف الشخصية فقط. */
export function reorderPersonalShelves(ids: readonly string[]): void {
  const shelves = read(), systems = shelves.filter(shelf => shelf.system), personal = shelves.filter(shelf => !shelf.system)
  const rank = new Map(ids.map((id, index) => [id, index]))
  personal.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) || (a.order ?? 0) - (b.order ?? 0))
  write([...systems, ...personal.map((shelf, index) => ({ ...shelf, order: systems.length + index }))])
}

export function removeShelf(id: string): void {
  const shelves = read()
  if (shelves.some(shelf => shelf.id === id && shelf.system)) return
  write(shelves.filter(shelf => shelf.id !== id))
}
