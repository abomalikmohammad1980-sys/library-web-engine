import {uiTemplateText} from '../ui_template_binding'
import { pageContent } from '../components'
import { bookCover } from '../book_cover'
import { getBook, downloadBytes, type StoredBook } from '../engine/library_store'
import { needsPdfRefresh } from '../engine/word_pdf'
import { bookAuthorLinks, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import { icon } from '../icons'
import { h, toast } from '../ui'
import { createShelf, listShelves, setBookOnShelf } from '../shelf_store'
import { stateView } from '../state_view'
import { createReadingPlan, getReadingPlan, pauseReadingPlan, planProgress, readingPosition, removeReadingPlan, resumeReadingPlan, saveReadingPlan, updateReadingPlanMinutes } from '../reading_plan'
import { bookPageCount, bookVolumeCount, cachedReaderPageCount, wordPageMaximum } from '../book_page_count'
import { BOOK_FORMATS, formatLabel, inferBookFormat } from '../book_format'
import { silentSkeleton } from '../silent_skeleton'
import { createBookIssueReportButton } from '../book_issue_report'
import { localOriginalAsset } from '../library_card_state'
import { withExtractedEditionMetadata } from '../edition_metadata'
import { captureReadingIdentity } from '../reading_identity_scope'
import {wordConformityLabel} from '../word_conformity'
import {publishedBookControls} from '../published_book_controls'
import {independentPdfPanel} from '../independent_pdf_panel'

export function bookScreen(id: string): HTMLElement {
  const root = pageContent(silentSkeleton('page'))
  void getBook(id).then(book => {
    if (!book) throw new Error('الكتاب غير موجود')
    root.replaceChildren(renderBook(book))
  }).catch(() => root.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح صفحة الكتاب', description: 'قد يكون الكتاب محذوفًا أو تعذر الوصول إلى التخزين المحلي.', actionLabel: 'العودة إلى المكتبة', href: '#/library' })))
  return root
}
function renderBook(book: StoredBook): HTMLElement {
  const metadataBook = withExtractedEditionMetadata(book)
  const category = effectiveBookCategory(book)
  const sourceIsPdf = inferBookFormat(book) === 'pdf'
  const sourceIsText = inferBookFormat(book) === 'text'
  const sourceIsEpub = inferBookFormat(book) === 'epub'
  const sourceIsBok = inferBookFormat(book) === 'shamela-bok'
  const original=localOriginalAsset(book)
  const actions = h('div', { class: 'book-profile__actions' }, h('a', { class: 'btn btn--primary', href: `#/reader/${book.id}` }, icon('book', 18), 'ابدأ القراءة'))
  if(original){const download=h('button', { class: 'btn btn--secondary', type: 'button' }, icon('download', 17), sourceIsPdf ? 'تحميل PDF' : sourceIsText ? 'تحميل النص الأصلي' : sourceIsEpub ? 'تحميل EPUB الأصلي' : sourceIsBok ? 'تحميل BOK الأصلي' : 'تحميل Word');download.addEventListener('click',()=>downloadBytes(original.bytes,original.fileName,original.mimeType));actions.append(download)}
  if (book.managedSource === 'published') actions.appendChild(createBookIssueReportButton(book))
  if (sourceIsEpub || sourceIsBok) actions.appendChild(h('a', { class: 'btn btn--secondary', href: `#/reader/${book.id}?print=1` }, icon('download', 17), 'حفظ PDF منسق'))
  if (!sourceIsPdf && !sourceIsText && !sourceIsEpub && !sourceIsBok && !needsPdfRefresh(book)) {
    const pdf = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('download', 17), 'تحميل PDF')
    pdf.addEventListener('click', () => downloadBytes(book.pdfData!, book.pdfFileName ?? `${book.title}.pdf`, 'application/pdf'))
    actions.appendChild(pdf)
  }
  const editorHost=h('section',{'aria-label':'تعديل الكتاب',hidden:true})
  actions.append(publishedBookControls(book,editorHost))
  const details = [
    ...(wordConformityLabel(book)?[datum('مطابقة صفحات Word',wordConformityLabel(book)!)]:[]),
    datum('صيغة المصدر', h('span', { class: 'book-format-badge' }, sourceIsBok ? 'BOK' : formatLabel(book))),
    datum('التصنيف', categoryLink(category), false),
    datum(book.authors && book.authors.length > 1 ? 'المؤلفون' : 'المؤلف', bookAuthorLinks(book), false),
    datum('الزمن', book.contemporary ? 'معاصر' : book.deathYearHijri ? `توفي سنة ${book.deathYearHijri} هـ` : 'غير موثق'),
    ...(bookVolumeCount(metadataBook) > 1 ? [datum('عدد الأجزاء', String(bookVolumeCount(metadataBook)))] : []),
    datum('عدد الصفحات', pageCount(book) > 0 ? `${pageCount(book)}${wordPageMaximum(book) > pageCount(book) ? ` · ترقيم Word حتى ${wordPageMaximum(book)}` : ''}` : 'غير متاح'),
    datum('البحث النصي', BOOK_FORMATS[inferBookFormat(book)].capabilities.searchable === 'when-text-layer' ? 'متاح إذا احتوى PDF طبقة نصية' : 'متاح'),
    datum('نسخة PDF', needsPdfRefresh(book) ? 'لم تُنشأ بعد' : 'متاحة للعرض والتنزيل'),
    ...(metadataBook.publisher ? [datum('الناشر', metadataBook.publisher, false)] : []),
    ...(metadataBook.edition ? [datum('الطبعة', metadataBook.edition, false)] : []),
    ...(metadataBook.investigator ? [datum('المحقق أو المراجع', metadataBook.investigator, false)] : []),
    ...(metadataBook.publicationYearHijri ? [datum('سنة النشر', `${metadataBook.publicationYearHijri} هـ`)] : []),
    ...(book.seriesName ? [datum('السلسلة العلمية', h('a', { href: `#/series?name=${encodeURIComponent(book.seriesName)}` }, `${book.seriesName}${book.seriesOrder ? ` · ${book.seriesOrder}` : ''}`), false)] : []),
    ...(book.tags?.length ? [datum('الوسوم', h('span', { class: 'book-tags' }, ...book.tags.map(tag => h('a', { class: 'book-tag', href: `#/library?tag=${encodeURIComponent(tag.name)}`, title: tag.source === 'toc' ? 'مستخرج من فهرس الكتاب' : 'أضيف يدويًا' }, `#${tag.name}`))), false)] : []),
  ]
  return h('article', { class: 'book-profile' },
    h('a', { class: 'book-profile__back', href: '#/library' }, 'المكتبة ←'),
    h('div', { class: 'book-profile__hero' },
      h('div', { class: 'book-profile__cover' }, bookCover(book, 'book-profile__cover-art')),
      h('div', { class: 'book-profile__intro' }, h('p', { class: 'page-eyebrow' }, categoryLink(category)), h('h1', { class: 'page-title', dataset: { noTranslate: '' } }, book.title), h('div', { class: 'book-profile__author', dataset: { noTranslate: '' } }, bookAuthorLinks(book)), actions),
    ),
    h('section', { class: 'book-profile__data', 'aria-label': 'بيانات الكتاب' }, ...details),
    independentPdfPanel(book,false),
    ...(book.description ? [h('section', { class: 'book-profile__section' }, h('h2', null, 'عن الكتاب'), h('p', { dataset: { noTranslate: '' } }, book.description))] : []),
    ...contentPreview(book),
    editorHost,
    readingPlanPanel(book),
    shelfPanel(book.id),
  )
}

export function readingPlanPanel(book: StoredBook, onChange:()=>void = ()=>{}): HTMLElement {
  const identity = captureReadingIdentity()
  const totalPages = pageCount(book)
  const section = h('section', { class: 'reading-plan', 'aria-labelledby': 'reading-plan-title' })
  const render = (): void => {
    if (!identity.isCurrent()) return
    const plan = getReadingPlan(book.id)
    if (plan) {
      const progress = planProgress(plan, readingPosition(book.id))
      const minutes = h('input', { type: 'number', min: '5', max: '180', step: '5', value: String(plan.minutesPerDay), 'aria-label': 'تعديل الدقائق اليومية' }) as HTMLInputElement
      const update = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تحديث الوقت')
      update.addEventListener('click', () => { if (!identity.isCurrent()) return; try { saveReadingPlan(updateReadingPlanMinutes(plan, Number(minutes.value))); render(); onChange(); toast('تحدث ورد القراءة دون تصفير تقدمك') } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر تحديث الوقت') } })
      const remove = h('button', { class: 'btn btn--secondary', type: 'button' }, 'إنهاء الخطة')
      const pause = h('button', { class: 'btn btn--secondary', type: 'button' }, plan.pausedAt ? 'استئناف الخطة' : 'إيقاف مؤقت')
      pause.addEventListener('click', () => { if (!identity.isCurrent()) return; saveReadingPlan(plan.pausedAt ? resumeReadingPlan(plan) : pauseReadingPlan(plan)); render(); onChange(); toast(plan.pausedAt ? 'استؤنفت الخطة' : 'أوقفت الخطة مؤقتًا') })
      remove.addEventListener('click', () => { if (!identity.isCurrent()) return; removeReadingPlan(book.id); render(); onChange(); toast('أُزيلت خطة القراءة') })
      section.replaceChildren(
        h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'reading-plan-title' }, 'خطتك لهذا الكتاب'), h('p', null, uiTemplateText('4ef952468a59f413',{p1:plan.minutesPerDay,p2:plan.pagesPerDay})))),
        h('div', { class: 'reading-plan__progress', role: 'status', 'aria-live': 'polite' }, h('strong', null, uiTemplateText('181bcb15056d88e2',{p1:progress.percent})), h('span', null, uiTemplateText('a5af12376f9e3336',{p1:progress.targetPageToday})), h('span', null, progress.remainingPages ? uiTemplateText('1a610853f218c44e',{p1:progress.daysRemaining}) : 'أتممت الكتاب بحمد الله')),
        h('div', { class: 'reading-plan__track', 'aria-hidden': 'true' }, h('span', { style: `width:${progress.percent}%` })),
        h('div', { class: 'reading-plan__actions' }, h('label', null, h('span', null, 'وقتي اليومي'), minutes, h('small', null, 'دقيقة')), update, h('a', { class: 'btn btn--primary', href: `#/reader/${book.id}` }, 'اقرأ ورد اليوم'), pause, remove),
      )
      return
    }
    const minutes = h('input', { type: 'number', min: '5', max: '180', step: '5', value: '15', 'aria-label': 'الدقائق المتاحة للقراءة يوميًا' }) as HTMLInputElement
    const start = h('button', { class: 'btn btn--primary', type: 'button' }, 'ابدأ الخطة')
    start.disabled = totalPages < 1
    start.addEventListener('click', () => {
      if (!identity.isCurrent()) return
      try { saveReadingPlan(createReadingPlan(book.id, totalPages, Number(minutes.value))); render(); onChange(); toast('أُنشئت خطة القراءة') }
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
  if (parts.length) children.push(h('div', { class: 'book-profile__parts' }, ...parts.map(part => h('a', { href: `#/reader/${book.id}?pageIndex=${Math.max(0, part.startPage - 1)}` },
    h('strong', part.title ? { dataset: { noTranslate: '' } } : null, part.title || uiTemplateText('87d061d51b726e3b',{p1:part.number})),
    h('small', null, uiTemplateText('56b61fd2ddd2a109',{p1:part.startPage,p2:part.endPage})), icon('chevron-left', 16)))))
  if (pages.length) children.push(h('div', { class: 'book-profile__preview-list' }, ...pages.slice(0, 8).map(page => {
    const previewText = page.firstText || page.lastText
    return h('a', { href: `#/reader/${book.id}?pageIndex=${Math.max(0, page.physicalPage - 1)}` }, h('span', null, uiTemplateText('e95fdd861149fc31',{p1:page.adjustedPage})),
      h('p', previewText ? { dataset: { noTranslate: '' } } : null, previewText || 'صفحة من الكتاب'), icon('chevron-left', 15))
  })))
  return [h('section', { class: 'book-profile__section', 'aria-labelledby': 'book-preview-title' }, h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'book-preview-title' }, parts.length ? 'أجزاء الكتاب ومعاينته' : 'معاينة الكتاب'), h('p', null, 'انتقل مباشرة إلى صفحة أو جزء دون فتح الكتاب من بدايته.'))), ...children)]
}

function datum(label: string, value: string | HTMLElement, translateValue = true): HTMLElement {
  const content = typeof value === 'string' ? h('strong', null, value) : value
  if (!translateValue) content.dataset.noTranslate = ''
  return h('div', { class: 'book-profile__datum' }, h('span', null, label), content)
}

function shelfPanel(bookId: string): HTMLElement {
  const section = h('section', { class: 'book-shelves', 'aria-labelledby': 'book-shelves-title' })
  const render = (): void => {
    const shelves = listShelves()
    const list = h('div', { class: 'book-shelves__list' }, ...shelves.map(shelf => {
      const input = h('input', { type: 'checkbox' }) as HTMLInputElement
      input.checked = shelf.bookIds.includes(bookId)
      input.addEventListener('change', () => { setBookOnShelf(shelf.id, bookId, input.checked); toast(input.checked ? `أضيف إلى «${shelf.name}»` : `أزيل من «${shelf.name}»`) })
      return h('label', { class: 'book-shelves__choice' }, input, h('span', { dataset: { noTranslate: '' } }, shelf.name))
    }))
    const name = h('input', { type: 'text', placeholder: 'اسم رف جديد', 'aria-label': 'اسم الرف الجديد' }) as HTMLInputElement
    const add = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('plus', 16), 'إنشاء رف')
    add.addEventListener('click', () => { try { const shelf = createShelf(name.value); setBookOnShelf(shelf.id, bookId, true); render(); toast('أُنشئ الرف وأضيف إليه الكتاب') } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر إنشاء الرف') } })
    section.replaceChildren(h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'book-shelves-title' }, 'رفوفك الشخصية'), h('p', null, 'ضع الكتاب في رف أو أكثر لتعود إليه سريعًا.')), h('a', { href: '#/shelves' }, 'إدارة الرفوف')), list, h('div', { class: 'book-shelves__create' }, name, add))
  }
  render()
  return section
}

