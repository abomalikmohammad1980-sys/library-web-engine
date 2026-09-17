import { pageContent } from '../components'
import { bookCover } from '../book_cover'
import { getBook, downloadBytes, type StoredBook } from '../engine/library_store'
import { needsPdfRefresh } from '../engine/word_pdf'
import { bookAuthorLinks, categoryLink } from '../taxonomy_links'
import { icon } from '../icons'
import { h, toast } from '../ui'
import { createShelf, listShelves, setBookOnShelf } from '../shelf_store'
import { stateView } from '../state_view'
import { createReadingPlan, getReadingPlan, pauseReadingPlan, planProgress, readingPosition, removeReadingPlan, resumeReadingPlan, saveReadingPlan, updateReadingPlanMinutes } from '../reading_plan'
import { bookPageCount, cachedReaderPageCount, wordPageMaximum } from '../book_page_count'
import { BOOK_FORMATS, formatLabel, inferBookFormat } from '../book_format'

export function bookScreen(id: string): HTMLElement {
  const root = pageContent(stateView({ kind: 'loading', icon: 'book', title: 'جارٍ فتح بطاقة الكتاب' }))
  void getBook(id).then(book => {
    if (!book) throw new Error('الكتاب غير موجود')
    root.replaceChildren(renderBook(book))
  }).catch(() => root.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح صفحة الكتاب', description: 'قد يكون الكتاب محذوفًا أو تعذر الوصول إلى التخزين المحلي.', actionLabel: 'العودة إلى المكتبة', href: '#/library' })))
  return root
}

function renderBook(book: StoredBook): HTMLElement {
  const sourceIsPdf = inferBookFormat(book) === 'pdf'
  const sourceIsText = inferBookFormat(book) === 'text'
  const sourceIsEpub = inferBookFormat(book) === 'epub'
  const sourceIsBok = inferBookFormat(book) === 'shamela-bok'
  const word = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('download', 17), sourceIsPdf ? 'تحميل PDF' : sourceIsText ? 'تحميل النص الأصلي' : sourceIsEpub ? 'تحميل EPUB الأصلي' : sourceIsBok ? 'تحميل BOK الأصلي' : 'تحميل Word')
  word.addEventListener('click', () => downloadBytes(book.sourceData ?? book.data, book.fileName, book.sourceMimeType || book.mimeType))
  const actions = h('div', { class: 'book-profile__actions' }, h('a', { class: 'btn btn--primary', href: `#/reader/${book.id}` }, icon('book', 18), 'ابدأ القراءة'), word)
  if (sourceIsEpub || sourceIsBok) actions.appendChild(h('a', { class: 'btn btn--secondary', href: `#/reader/${book.id}?print=1` }, icon('download', 17), 'حفظ PDF منسق'))
  if (!sourceIsPdf && !sourceIsText && !sourceIsEpub && !sourceIsBok && !needsPdfRefresh(book)) {
    const pdf = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('download', 17), 'تحميل PDF')
    pdf.addEventListener('click', () => downloadBytes(book.pdfData!, book.pdfFileName ?? `${book.title}.pdf`, 'application/pdf'))
    actions.appendChild(pdf)
  }
  const details = [
    datum('صيغة المصدر', h('span', { class: 'book-format-badge' }, formatLabel(book))),
    datum('التصنيف', book.category ? categoryLink(book.category) : 'غير مصنّف'),
    datum(book.authors && book.authors.length > 1 ? 'المؤلفون' : 'المؤلف', bookAuthorLinks(book)),
    datum('الزمن', book.contemporary ? 'معاصر' : book.deathYearHijri ? `توفي سنة ${book.deathYearHijri} هـ` : 'غير موثق'),
    datum('الأجزاء', String(book.volumes?.length ?? book.parts?.length ?? 1)),
    datum('الصفحات', pageCount(book) ? `${pageCount(book)} صفحة${wordPageMaximum(book) > pageCount(book) ? ` · ترقيم Word حتى ${wordPageMaximum(book)}` : ''}` : 'تُحسب عند فتح الكتاب'),
    datum('البحث النصي', BOOK_FORMATS[inferBookFormat(book)].capabilities.searchable === 'when-text-layer' ? 'متاح إذا احتوى PDF طبقة نصية' : 'متاح'),
    datum('نسخة PDF', needsPdfRefresh(book) ? 'لم تُنشأ بعد' : 'متاحة للعرض والتنزيل'),
    ...(book.publisher ? [datum('الناشر', book.publisher)] : []),
    ...(book.edition ? [datum('الطبعة', book.edition)] : []),
    ...(book.investigator ? [datum('المحقق أو المراجع', book.investigator)] : []),
    ...(book.publicationYearHijri ? [datum('سنة النشر', `${book.publicationYearHijri} هـ`)] : []),
    ...(book.seriesName ? [datum('السلسلة العلمية', h('a', { href: `#/series?name=${encodeURIComponent(book.seriesName)}` }, `${book.seriesName}${book.seriesOrder ? ` · ${book.seriesOrder}` : ''}`))] : []),
    ...(book.tags?.length ? [datum('الوسوم', h('span', { class: 'book-tags' }, ...book.tags.map(tag => h('a', { class: 'book-tag', href: `#/library?tag=${encodeURIComponent(tag.name)}`, title: tag.source === 'toc' ? 'مستخرج من فهرس الكتاب' : 'أضيف يدويًا' }, `#${tag.name}`))))] : []),
  ]
  return h('article', { class: 'book-profile' },
    h('a', { class: 'book-profile__back', href: '#/library' }, 'المكتبة ←'),
    h('div', { class: 'book-profile__hero' },
      h('div', { class: 'book-profile__cover' }, bookCover(book, 'book-profile__cover-art')),
      h('div', { class: 'book-profile__intro' }, h('p', { class: 'page-eyebrow' }, book.category ? categoryLink(book.category) : 'كتاب في الخزانة'), h('h1', { class: 'page-title' }, book.title), h('div', { class: 'book-profile__author' }, bookAuthorLinks(book)), actions),
    ),
    h('section', { class: 'book-profile__data', 'aria-label': 'بيانات الكتاب' }, ...details),
    ...(book.description ? [h('section', { class: 'book-profile__section' }, h('h2', null, 'عن الكتاب'), h('p', null, book.description))] : []),
    ...contentPreview(book),
    readingPlanPanel(book),
    shelfPanel(book.id),
  )
}

function readingPlanPanel(book: StoredBook): HTMLElement {
  const totalPages = pageCount(book)
  const section = h('section', { class: 'reading-plan', 'aria-labelledby': 'reading-plan-title' })
  const render = (): void => {
    const plan = getReadingPlan(book.id)
    if (plan) {
      const progress = planProgress(plan, readingPosition(book.id))
      const minutes = h('input', { type: 'number', min: '5', max: '180', step: '5', value: String(plan.minutesPerDay), 'aria-label': 'تعديل الدقائق اليومية' }) as HTMLInputElement
      const update = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تحديث الوقت')
      update.addEventListener('click', () => { try { saveReadingPlan(updateReadingPlanMinutes(plan, Number(minutes.value))); render(); toast('تحدث ورد القراءة دون تصفير تقدمك') } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر تحديث الوقت') } })
      const remove = h('button', { class: 'btn btn--secondary', type: 'button' }, 'إنهاء الخطة')
      const pause = h('button', { class: 'btn btn--secondary', type: 'button' }, plan.pausedAt ? 'استئناف الخطة' : 'إيقاف مؤقت')
      pause.addEventListener('click', () => { saveReadingPlan(plan.pausedAt ? resumeReadingPlan(plan) : pauseReadingPlan(plan)); render(); toast(plan.pausedAt ? 'استؤنفت الخطة' : 'أوقفت الخطة مؤقتًا') })
      remove.addEventListener('click', () => { removeReadingPlan(book.id); render(); toast('أُزيلت خطة القراءة') })
      section.replaceChildren(
        h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'reading-plan-title' }, 'خطتك لهذا الكتاب'), h('p', null, `${plan.minutesPerDay} دقيقة يوميًا · ${plan.pagesPerDay} صفحات`))),
        h('div', { class: 'reading-plan__progress', role: 'status', 'aria-live': 'polite' }, h('strong', null, `وصلت إلى ${progress.percent}٪`), h('span', null, `هدف اليوم: الصفحة ${progress.targetPageToday}`), h('span', null, progress.remainingPages ? `نحو ${progress.daysRemaining} أيام للإتمام` : 'أتممت الكتاب بحمد الله')),
        h('div', { class: 'reading-plan__track', 'aria-hidden': 'true' }, h('span', { style: `width:${progress.percent}%` })),
        h('div', { class: 'reading-plan__actions' }, h('label', null, h('span', null, 'وقتي اليومي'), minutes, h('small', null, 'دقيقة')), update, h('a', { class: 'btn btn--primary', href: `#/reader/${book.id}` }, 'اقرأ ورد اليوم'), pause, remove),
      )
      return
    }
    const minutes = h('input', { type: 'number', min: '5', max: '180', step: '5', value: '15', 'aria-label': 'الدقائق المتاحة للقراءة يوميًا' }) as HTMLInputElement
    const start = h('button', { class: 'btn btn--primary', type: 'button' }, 'ابدأ الخطة')
    start.disabled = totalPages < 1
    start.addEventListener('click', () => {
      try { saveReadingPlan(createReadingPlan(book.id, totalPages, Number(minutes.value))); render(); toast('أُنشئت خطة القراءة') }
      catch (error) { toast(error instanceof Error ? error.message : 'تعذّر إنشاء الخطة') }
    })
    section.replaceChildren(
      h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'reading-plan-title' }, 'ابدأ هذا الكتاب بخطة'), h('p', null, totalPages ? 'حدد وقتك اليومي، وسنحوّله إلى ورد صفحات واضح.' : 'ستتاح الخطة بعد حساب صفحات الكتاب عند فتحه أول مرة.'))),
      h('div', { class: 'reading-plan__form' }, h('label', null, h('span', null, 'وقتي اليومي'), minutes, h('small', null, 'دقيقة')), start),
    )
  }
  render()
  return section
}

function pageCount(book: StoredBook): number {
  return bookPageCount(book, cachedReaderPageCount(book.id))
}

function contentPreview(book: StoredBook): HTMLElement[] {
  const pages = book.wordPageMap?.pages ?? []
  const parts = book.parts ?? []
  if (!pages.length && !parts.length) return []
  const children: HTMLElement[] = []
  if (parts.length) children.push(h('div', { class: 'book-profile__parts' }, ...parts.map(part => h('a', { href: `#/reader/${book.id}?pageIndex=${Math.max(0, part.startPage - 1)}` }, h('strong', null, part.title || `الجزء ${part.number}`), h('small', null, `من الصفحة ${part.startPage} إلى ${part.endPage}`), icon('chevron-left', 16)))))
  if (pages.length) children.push(h('div', { class: 'book-profile__preview-list' }, ...pages.slice(0, 8).map(page => h('a', { href: `#/reader/${book.id}?pageIndex=${Math.max(0, page.physicalPage - 1)}` }, h('span', null, `صفحة ${page.adjustedPage}`), h('p', null, page.firstText || page.lastText || 'صفحة من الكتاب'), icon('chevron-left', 15)))))
  return [h('section', { class: 'book-profile__section', 'aria-labelledby': 'book-preview-title' }, h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'book-preview-title' }, parts.length ? 'أجزاء الكتاب ومعاينته' : 'معاينة الكتاب'), h('p', null, 'انتقل مباشرة إلى صفحة أو جزء دون فتح الكتاب من بدايته.'))), ...children)]
}

function datum(label: string, value: string | HTMLElement): HTMLElement {
  return h('div', { class: 'book-profile__datum' }, h('span', null, label), typeof value === 'string' ? h('strong', null, value) : value)
}

function shelfPanel(bookId: string): HTMLElement {
  const section = h('section', { class: 'book-shelves', 'aria-labelledby': 'book-shelves-title' })
  const render = (): void => {
    const shelves = listShelves()
    const list = h('div', { class: 'book-shelves__list' }, ...shelves.map(shelf => {
      const input = h('input', { type: 'checkbox' }) as HTMLInputElement
      input.checked = shelf.bookIds.includes(bookId)
      input.addEventListener('change', () => { setBookOnShelf(shelf.id, bookId, input.checked); toast(input.checked ? `أضيف إلى «${shelf.name}»` : `أزيل من «${shelf.name}»`) })
      return h('label', { class: 'book-shelves__choice' }, input, h('span', null, shelf.name))
    }))
    const name = h('input', { type: 'text', placeholder: 'اسم رف جديد', 'aria-label': 'اسم الرف الجديد' }) as HTMLInputElement
    const add = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('plus', 16), 'إنشاء رف')
    add.addEventListener('click', () => { try { const shelf = createShelf(name.value); setBookOnShelf(shelf.id, bookId, true); render(); toast('أُنشئ الرف وأضيف إليه الكتاب') } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر إنشاء الرف') } })
    section.replaceChildren(h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'book-shelves-title' }, 'رفوفك الشخصية'), h('p', null, 'ضع الكتاب في رف أو أكثر لتعود إليه سريعًا.')), h('a', { href: '#/shelves' }, 'إدارة الرفوف')), list, h('div', { class: 'book-shelves__create' }, name, add))
  }
  render()
  return section
}
