/** Presentation-only, identity-keyed author names. Storage, search and links stay canonical. */
type ReviewedName = Readonly<{ source: string; display: string }>
let english: ReadonlyMap<string, ReviewedName> = new Map()
let ready = false
let pending: Promise<void> | undefined

function identity(value: string | undefined): string {
  const raw = value?.trim() ?? ''
  const match = /^(?:(?:shamela:|shamela-|shamela-author-|local:shamela-author-))?(\d+)$/.exec(raw)
  return match ? `shamela:${Number(match[1])}` : raw
}

export async function prepareAuthorDisplayLocale(locale: string): Promise<void> {
  if (locale.toLowerCase().split('-')[0] !== 'en' || ready) return
  pending ??= (async () => {
    const { default: reviewed } = await import('./i18n/en-author-names.reviewed.json')
    const next = new Map<string, ReviewedName>()
    for (const row of reviewed.rows as [string, string, string][]) {
      const [authorIdentity, source, display] = row
      if (!authorIdentity || !source || !display || next.has(authorIdentity)) throw new Error('author_locale_data_invalid')
      next.set(authorIdentity, Object.freeze({ source, display }))
    }
    english = next
    ready = true
  })().finally(() => { pending = undefined })
  return pending
}

export function localizedAuthorDisplayName(authorIdentity: string | undefined, canonicalName: string, locale: string): string {
  if (locale.toLowerCase().split('-')[0] !== 'en') return canonicalName
  const row = english.get(identity(authorIdentity))
  return row?.source === canonicalName ? row.display : canonicalName
}

export function reviewedAuthorNameCoverage(): number { return english.size }

export function resetAuthorLocaleDisplayForTests(): void { english = new Map(); ready = false; pending = undefined }
