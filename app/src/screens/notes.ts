import { deleteHighlight, deleteNote, getAnnotations, toggleBookmark, type HighlightColor } from '../annotation_store'
import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { icon } from '../icons'
import { arabicNum, h, toast } from '../ui'
import { mountStateView, stateView } from '../state_view'
import { quoteCardDataUrl } from '../quote_card'
import { annotationsMarkdown } from '../annotations_markdown'
import { downloadArtifact } from '../artifact_download'
import { annotationActionLabel, annotationDeletePrompt, annotationTitleId } from '../annotation_accessibility'
import { buildRichClipboard, writeRichClipboard } from '../rich_clipboard'
import { dueAnnotationIds, makeReviewDueNow, nextReviewAt, recordReview, reviewTiming } from '../spaced_review'
import { currentHashQuery, replaceHashQuery } from '../hash_query_state'

type Kind = 'all' | 'note' | 'highlight' | 'bookmark' | 'review' | 'scheduled'
type ItemKind = 'note' | 'highlight' | 'bookmark'
type NoteItem = { id: string; kind: ItemKind; bookId: string; pageIndex: number; text: string; createdAt: number; color?: HighlightColor }

export function notesScreen(): HTMLElement {
  const root = pageContent(h('section', { class: 'notes-hero', 'aria-labelledby': 'notes-title' }, h('p', { class: 'page-eyebrow' }, 'ذاكرة القراءة'), h('h1', { class: 'page-title', id: 'notes-title' }, 'علاماتك وملاحظاتك'), h('p', { class: 'page-sub' }, 'كل ما حفظته أثناء القراءة، مرتب وقابل للبحث والعودة إلى موضعه.')))
  const mount = stateView({ kind: 'loading', icon: 'bookmark', title: 'جارٍ جمع ذاكرة القراءة' })
  root.appendChild(mount); void hydrate(mount)
  return root
}

async function hydrate(root: HTMLElement): Promise<void> {
  try {
  const books = await listBooks()
  const titles = new Map(books.map(book => [book.id, { title: book.title, author: book.author }]))
  const search = h('input', { type: 'search', placeholder: 'ابحث في الملاحظات والنصوص والكتب…', 'aria-label': 'البحث في ذاكرة القراءة' }) as HTMLInputElement
  const tabs = h('div', { class: 'notes-tabs', role: 'group', 'aria-label': 'نوع المحفوظات' })
  const list = h('section', { class: 'notes-list', 'aria-live': 'polite' })
  const summary = h('strong', { class: 'notes-summary' })
  const clearSearch = h('button', { type: 'button', class: 'btn btn--ghost', hidden: true }, 'مسح البحث') as HTMLButtonElement
  const exportButton = h('button', { type: 'button', class: 'btn btn--secondary' }, icon('download', 16), 'تصدير Markdown') as HTMLButtonElement
  exportButton.addEventListener('click', () => {
    const state = getAnnotations()
    const count = state.notes.length + state.highlights.length + Object.values(state.bookmarks).reduce((sum, pages) => sum + pages.length, 0)
    if (!count) { toast('لا توجد محفوظات لتصديرها'); return }
    downloadArtifact({ fileName: 'alkhizana-reading-memory.md', mimeType: 'text/markdown;charset=utf-8', content: annotationsMarkdown(state, titles) })
    toast('جُهز ملف ذاكرة القراءة')
  })
  const requestedKind = currentHashQuery().get('kind') as Kind | null
  let active: Kind = requestedKind && ['all', 'review', 'scheduled', 'note', 'highlight', 'bookmark'].includes(requestedKind) ? requestedKind : 'all'
  search.value = currentHashQuery().get('q') ?? ''
  const render = (): void => {
    const state = getAnnotations()
    const items: NoteItem[] = [
      ...state.notes.map(note => ({ ...note, kind: 'note' as const })),
      ...state.highlights.map(highlight => ({ ...highlight, kind: 'highlight' as const })),
      ...Object.entries(state.bookmarks).flatMap(([bookId, pages]) => pages.map(pageIndex => ({ id: `${bookId}:${pageIndex}`, kind: 'bookmark' as const, bookId, pageIndex, text: `علامة الصفحة ${arabicNum(pageIndex + 1)}`, createdAt: 0 }))),
    ].sort((a, b) => b.createdAt - a.createdAt)
    const query = search.value.trim().toLocaleLowerCase('ar')
    clearSearch.hidden = !query
    const due = dueAnnotationIds(items.filter(item => item.kind !== 'bookmark').map(item => item.id))
    const matchesKind = (item: NoteItem): boolean => active === 'all' || active === 'review' ? active !== 'review' || (item.kind !== 'bookmark' && due.has(item.id)) : active === 'scheduled' ? item.kind !== 'bookmark' && reviewTiming(item.id) === 'scheduled' : item.kind === active
    const shown = items.filter(item => matchesKind(item) && (!query || `${item.text} ${titles.get(item.bookId)?.title ?? ''} ${titles.get(item.bookId)?.author ?? ''}`.toLocaleLowerCase('ar').includes(query)))
    summary.textContent = `${arabicNum(shown.length)} عنصرًا`
    list.replaceChildren()
    if (!shown.length) {
      const emptyTitle = active === 'review' ? 'لا توجد مراجعات مستحقة اليوم' : active === 'scheduled' ? 'لا توجد مراجعات قادمة مجدولة' : 'لم تحفظ شيئًا من هذا النوع بعد'
      list.appendChild(stateView({ kind: query ? 'no-results' : 'empty', icon: 'bookmark', title: query ? 'لا نتائج مطابقة' : emptyTitle, description: query ? 'جرّب عبارة أقصر أو غيّر نوع المحفوظات.' : active === 'review' || active === 'scheduled' ? 'راجع محفوظاتك، وستظهر المواعيد هنا بعد جدولة أول مراجعة.' : 'حدّد نصًا في القارئ أو أضف علامة، وسيظهر هنا.', compact: true })); return
    }
    for (const item of shown) {
      const meta = titles.get(item.bookId)
      const bookTitle = meta?.title ?? 'كتاب محفوظ'
      const label = kindLabel(item.kind)
      const titleId = annotationTitleId(item.id)
      const open = h('a', { class: 'notes-card__open', href: `#/reader/${item.bookId}?pageIndex=${item.pageIndex}` }, h('span', null, meta?.title ?? 'كتاب محفوظ'), icon('arrow-back', 17))
      const remove = h('button', { class: 'notes-card__delete', type: 'button', 'aria-label': annotationActionLabel('delete', label, bookTitle, item.pageIndex + 1) }, icon('close', 16))
      const share = h('a', { class: 'notes-card__share', href: quoteCardDataUrl({ quote: item.text, book: bookTitle, ...(meta?.author ? { author: meta.author } : {}), page: item.pageIndex + 1 }), 'aria-label': annotationActionLabel('download', label, bookTitle, item.pageIndex + 1), title: 'بطاقة اقتباس' }, icon('download', 16)) as HTMLAnchorElement
      share.download = `alkhizana-quote-${item.pageIndex + 1}.svg`
      const copy = h('button', { class: 'notes-card__share', type: 'button', 'aria-label': annotationActionLabel('copy', label, bookTitle, item.pageIndex + 1), title: 'نسخ موثّق' }, icon('copy', 16))
      copy.addEventListener('click', () => {
        const source = [`${bookTitle} (الورقة ${item.pageIndex + 1})`, meta?.author].filter(Boolean).join(' — ')
        void writeRichClipboard(buildRichClipboard(item.text, source)).then(() => toast('نُسخت الإحالة الموثقة')).catch(() => toast('تعذّر النسخ إلى الحافظة'))
      })
      remove.addEventListener('click', () => {
        if (!confirm(annotationDeletePrompt(label, item.pageIndex + 1, bookTitle))) return
        if (item.kind === 'note') deleteNote(item.id)
        else if (item.kind === 'highlight') deleteHighlight(item.id)
        else toggleBookmark(item.bookId, item.pageIndex)
        toast('حُذف العنصر'); render()
      })
      const card = h('article', { class: 'notes-card', 'aria-labelledby': titleId }, h('div', { class: 'notes-card__head' }, h('span', { class: `notes-kind notes-kind--${item.kind}` }, label), h('span', null, `صفحة ${arabicNum(item.pageIndex + 1)}`)), h('p', { class: 'notes-card__text', id: titleId }, item.text), h('div', { class: 'notes-card__foot' }, h('span', null, meta?.author ?? ''), open, item.kind === 'bookmark' ? null : copy, item.kind === 'bookmark' ? null : share, remove))
      const nextDue = item.kind === 'bookmark' ? null : nextReviewAt(item.id)
      if (nextDue !== null && active !== 'review') {
        const status = reviewTiming(item.id) === 'due' ? 'المراجعة مستحقة الآن' : `المراجعة القادمة: ${new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(nextDue)}`
        card.appendChild(h('p', { class: 'notes-card__review-status' }, status))
      }
      if (active === 'review' && item.kind !== 'bookmark') {
        const remembered = h('button', { type: 'button', class: 'btn btn--primary', 'aria-label': annotationActionLabel('remembered', label, bookTitle, item.pageIndex + 1) }, 'تذكرت')
        const again = h('button', { type: 'button', class: 'btn btn--secondary', 'aria-label': annotationActionLabel('again', label, bookTitle, item.pageIndex + 1) }, 'راجع قريبًا')
        remembered.addEventListener('click', () => { recordReview(item.id, 'remembered'); toast('حُددت المراجعة التالية'); render() })
        again.addEventListener('click', () => { recordReview(item.id, 'again'); toast('ستعود الفائدة غدًا'); render() })
        card.appendChild(h('div', { class: 'notes-card__review-actions' }, remembered, again))
      }
      if (active === 'scheduled' && item.kind !== 'bookmark') {
        const dueToday = h('button', { type: 'button', class: 'btn btn--secondary', 'aria-label': annotationActionLabel('dueNow', label, bookTitle, item.pageIndex + 1) }, 'راجع اليوم')
        dueToday.addEventListener('click', () => { if (makeReviewDueNow(item.id)) { toast('نُقلت الفائدة إلى مراجعة اليوم'); render() } })
        card.appendChild(h('div', { class: 'notes-card__review-actions' }, dueToday))
      }
      if (item.color) card.dataset.highlightColor = item.color
      list.appendChild(card)
    }
  }
  for (const [id, label] of [['all', 'الكل'], ['review', 'مراجعة اليوم'], ['scheduled', 'مراجعات قادمة'], ['note', 'ملاحظات'], ['highlight', 'تظليلات'], ['bookmark', 'علامات']] as const) {
    const button = h('button', { type: 'button' }, label)
    button.setAttribute('aria-pressed', String(id === active))
    button.addEventListener('click', () => { active = id; replaceHashQuery({ kind: id === 'all' ? null : id }); tabs.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node === button))); render() })
    tabs.appendChild(button)
  }
  search.addEventListener('input', () => { replaceHashQuery({ q: search.value.trim() || null }); render() })
  clearSearch.addEventListener('click', () => { search.value = ''; replaceHashQuery({ q: null }); render(); search.focus() })
  root.className = 'notes-workspace'; root.removeAttribute('role')
  root.replaceChildren(h('div', { class: 'notes-controls' }, h('div', { class: 'notes-search' }, icon('search', 18), search), tabs, summary, clearSearch, exportButton), list)
  render()
  } catch {
    mountStateView(root, { kind: 'error', title: 'تعذّر جمع ذاكرة القراءة', description: 'محفوظاتك لم تتغير. أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(root) })
  }
}

function kindLabel(kind: ItemKind): string { return kind === 'note' ? 'ملاحظة' : kind === 'highlight' ? 'تظليل' : 'علامة' }
