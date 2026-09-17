import { pageContent } from '../components'
import { bookCover } from '../book_cover'
import { listBooks, type StoredBook } from '../engine/library_store'
import { createShelf, listShelves, removeShelf, setBookOnShelf } from '../shelf_store'
import { icon } from '../icons'
import { h, toast } from '../ui'
import { mountStateView, stateView } from '../state_view'

export function shelvesScreen(): HTMLElement {
  const host = stateView({ kind: 'loading', icon: 'book', title: 'جارٍ ترتيب رفوفك' })
  const root = pageContent(h('section', { class: 'library-hero' }, h('p', { class: 'page-eyebrow' }, 'مكتبتي'), h('h1', { class: 'page-title' }, 'الرفوف الشخصية'), h('p', { class: 'page-sub' }, 'اختر الكتب وأزلها من كل رف هنا مباشرة؛ ويمكن للكتاب أن يظهر في أكثر من رف.')), host)
  void hydrate(host)
  return root
}

function shelfBookPicker(shelfId: string, shelfName: string, choices: StoredBook[], rerender: () => void): HTMLElement {
  const input = h('input', { type: 'search', placeholder: 'اكتب جزءًا من اسم الكتاب…', 'aria-label': `اختيار كتاب لإضافته إلى رف ${shelfName}` }) as HTMLInputElement
  const results = h('div', { class: 'shelf-card__picker-results', role: 'listbox', 'aria-label': `كتب المكتبة المتاحة لرف ${shelfName}` })
  const filteredChoices = (): StoredBook[] => {
    const query = normalizeShelfChoice(input.value)
    return choices.filter(book => !query || normalizeShelfChoice(shelfBookChoiceLabel(book)).includes(query)).slice(0, 12)
  }
  const renderResults = (): void => {
    const visible = filteredChoices()
    results.replaceChildren(...visible.map(book => {
      const choice = h('button', { class: 'shelf-card__picker-choice', type: 'button', role: 'option', title: shelfBookChoiceLabel(book) },
        bookCover(book, 'shelf-card__picker-cover'), h('span', null, h('strong', null, book.title), h('small', null, book.author || 'مؤلف غير معروف')))
      choice.addEventListener('click', () => { setBookOnShelf(shelfId, book.id, true); rerender() })
      return choice
    }), ...(visible.length ? [] : [stateView({ kind: 'no-results', icon: 'search', title: 'لا يوجد كتاب بهذا الاسم', compact: true })]))
  }
  input.addEventListener('input', renderResults)
  input.addEventListener('focus', renderResults)
  const add = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('plus', 16), 'إضافة الكتاب')
  add.addEventListener('click', () => {
    const selected = resolveShelfBookChoice(choices, input.value)
    if (!selected) { toast(input.value.trim() ? 'تابع الكتابة أو اختر كتابًا واحدًا من القائمة' : 'اكتب جزءًا من اسم الكتاب واختره من القائمة'); input.focus(); return }
    setBookOnShelf(shelfId, selected.id, true); rerender()
  })
  const picker = h('div', { class: 'shelf-card__picker' }, input, add, results)
  renderResults()
  return picker
}

function normalizeShelfChoice(value: string): string {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '').replace(/ـ/gu, '').replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('ar')
}

function shelfBookChoiceLabel(book: Pick<StoredBook, 'title' | 'author'>): string {
  return [book.title, book.author].filter(Boolean).join(' — ')
}

export function resolveShelfBookChoice<T extends Pick<StoredBook, 'id' | 'title' | 'author'>>(choices: readonly T[], value: string): T | undefined {
  const query = normalizeShelfChoice(value)
  if (!query) return undefined
  const exact = choices.filter(book => normalizeShelfChoice(shelfBookChoiceLabel(book)) === query || normalizeShelfChoice(book.title) === query)
  if (exact.length === 1) return exact[0]
  const partial = choices.filter(book => normalizeShelfChoice(shelfBookChoiceLabel(book)).includes(query))
  return partial.length === 1 ? partial[0] : undefined
}

async function hydrate(host: HTMLElement): Promise<void> {
  mountStateView(host, { kind: 'loading', icon: 'book', title: 'جارٍ ترتيب رفوفك' })
  let books: StoredBook[]
  try { books = await listBooks() }
  catch { mountStateView(host, { kind: 'error', title: 'تعذّر فتح الرفوف', description: 'كتبك لم تتغير. أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(host) }); return }
  const render = (): void => {
    const shelves = listShelves()
    const name = h('input', { type: 'text', placeholder: 'أنشئ رفًا جديدًا…', 'aria-label': 'اسم رف جديد' }) as HTMLInputElement
    const add = h('button', { class: 'btn btn--primary', type: 'button' }, icon('plus', 17), 'إضافة رف')
    add.addEventListener('click', () => { try { createShelf(name.value); render() } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر إنشاء الرف') } })
    const grid = h('div', { class: 'shelves-grid' }, ...shelves.map(shelf => {
      const shelfBooks = books.filter(book => shelf.bookIds.includes(book.id))
      const choices = books.filter(book => !shelf.bookIds.includes(book.id))
      const remove = h('button', { class: 'shelf-card__remove', type: 'button', 'aria-label': `حذف رف ${shelf.name}` }, icon('close', 16))
      remove.addEventListener('click', () => { if (confirm(`حذف رف «${shelf.name}»؟ لن تُحذف الكتب.`)) { removeShelf(shelf.id); render() } })
      const cards = shelfBooks.slice(0, 24).map(book => {
        const unlink = h('button', { class: 'shelf-card__book-remove', type: 'button', 'aria-label': `إزالة ${book.title} من رف ${shelf.name}` }, icon('close', 14))
        unlink.addEventListener('click', () => { setBookOnShelf(shelf.id, book.id, false); render() })
        return h('article', { class: 'shelf-card__book' }, h('a', { href: `#/reader/${book.id}`, title: book.title }, bookCover(book, 'shelf-card__cover'), h('span', null, book.title)), unlink)
      })
      return h('section', { class: 'shelf-card' },
        h('header', null, h('div', null, h('h2', null, shelf.name), h('p', null, `${shelfBooks.length} كتاب`)), remove),
        shelfBookPicker(shelf.id, shelf.name, choices, render),
        h('div', { class: 'shelf-card__books' }, ...cards, ...(cards.length ? [] : [stateView({ kind: 'empty', icon: 'book', title: 'هذا الرف فارغ', description: 'ابحث في كتب مكتبتك وأضف ما تريد مباشرة.' })])),
      )
    }))
    host.className = 'shelves-content'
    host.removeAttribute('role')
    host.replaceChildren(h('div', { class: 'shelves-create' }, name, add), grid)
  }
  render()
}
