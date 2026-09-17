type ReviewedTitle = Readonly<{ source: string; display: string }>
let english: ReadonlyMap<string, ReviewedTitle> = new Map()
let pending: Promise<void> | undefined

export async function prepareBookDisplayLocale(locale: string): Promise<void> {
  if (locale.toLowerCase().split('-')[0] !== 'en' || english.size) return
  pending ??= (async () => {
    const { default: reviewed } = await import('./i18n/en-book-titles.reviewed.json')
    const next = new Map<string, ReviewedTitle>()
    for (const [id, source, display] of reviewed.rows as [string, string, string][]) {
      if (!id || !source || !display || next.has(id)) throw new Error('book_locale_data_invalid')
      next.set(id, Object.freeze({ source, display }))
    }
    english = next
  })().finally(() => { pending = undefined })
  return pending
}

export function localizedBookDisplayTitle(id: string, canonicalTitle: string, locale: string): string {
  if (locale.toLowerCase().split('-')[0] !== 'en') return canonicalTitle
  const row = english.get(id)
  return row?.source === canonicalTitle ? row.display : canonicalTitle
}

export function bindBookDisplayTitle<T extends HTMLElement>(element: T, id: string, canonicalTitle: string): T {
  element.dataset.bookIdentity = id
  element.dataset.bookOriginal = canonicalTitle
  if (element.getAttribute('title') === canonicalTitle) element.dataset.bookTitleAttribute = ''
  const locale = typeof localStorage === 'undefined' ? 'ar' : localStorage.getItem('khizana:site-language') ?? 'ar'
  element.textContent = localizedBookDisplayTitle(id, canonicalTitle, locale)
  if ('bookTitleAttribute' in element.dataset) element.title = element.textContent
  return element
}

/** Attribute-only binding for composite links: never replaces their cover or text children. */
export function bindBookDisplayTitleTooltip<T extends HTMLElement>(element: T, id: string, canonicalTitle: string): T {
  element.dataset.bookTooltipIdentity = id
  element.dataset.bookTooltipOriginal = canonicalTitle
  const locale = typeof localStorage === 'undefined' ? 'ar' : localStorage.getItem('khizana:site-language') ?? 'ar'
  element.title = localizedBookDisplayTitle(id, canonicalTitle, locale)
  return element
}

export function repaintBookDisplayTitles(): void {
  if (typeof document === 'undefined') return
  const locale = typeof localStorage === 'undefined' ? 'ar' : localStorage.getItem('khizana:site-language') ?? 'ar'
  for (const element of document.querySelectorAll<HTMLElement>('[data-book-identity]')) {
    const source = element.dataset.bookOriginal ?? element.textContent ?? ''
    element.dataset.bookOriginal = source
    element.textContent = localizedBookDisplayTitle(element.dataset.bookIdentity ?? '', source, locale)
    if ('bookTitleAttribute' in element.dataset) element.title = element.textContent
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-book-tooltip-identity]')) {
    element.title = localizedBookDisplayTitle(element.dataset.bookTooltipIdentity ?? '', element.dataset.bookTooltipOriginal ?? '', locale)
  }
}

export function reviewedBookTitleCoverage(): number { return english.size }
