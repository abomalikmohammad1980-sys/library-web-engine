export function normalizeArabicAuthorName(value) {
  return String(value ?? '').normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').replace(/ـ/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar')
}

export function parseRequestedAuthor(raw) {
  const aliases = [...raw.matchAll(/\(([^)]*)\)/g)]
    .flatMap(match => match[1].split(/[،,]/)).map(value => value.trim()).filter(Boolean)
  const canonical = raw.replace(/\s*\([^)]*\)\s*$/g, '').trim()
  return { raw, canonical, aliases: [...new Set(aliases)] }
}

function orderedContains(longer, shorter) {
  const haystack = normalizeArabicAuthorName(longer).split(' ').filter(Boolean)
  const needles = normalizeArabicAuthorName(shorter).split(' ').filter(Boolean)
  if (needles.length < 2) return false
  if (haystack[0] !== needles[0] || haystack.at(-1) !== needles.at(-1)) return false
  let cursor = 0
  return needles.every(word => {
    const found = haystack.indexOf(word, cursor)
    if (found < 0) return false
    cursor = found + 1
    return true
  })
}

/** Exact names/aliases win; conservative token containment is accepted only when unique. */
export function matchCatalogAuthor(request, catalog) {
  const requested = [request.canonical, ...request.aliases].filter(Boolean)
  const exact = catalog.filter(author => requested.some(value =>
    [author.name, ...(author.aliases ?? [])].some(candidate => normalizeArabicAuthorName(candidate) === normalizeArabicAuthorName(value))))
  if (exact.length === 1) return { kind: 'existing', author: exact[0], method: 'exact-name-or-alias' }
  if (exact.length > 1) return { kind: 'review', matches: exact, reason: 'ambiguous-exact-alias' }
  const contained = catalog.filter(author => orderedContains(author.name, request.canonical) || orderedContains(request.canonical, author.name))
  if (contained.length === 1) return { kind: 'existing', author: contained[0], method: 'unique-ordered-token-alias' }
  if (contained.length > 1) return { kind: 'review', matches: contained, reason: 'ambiguous-token-match' }
  return { kind: 'missing' }
}

export function isGeneralOrAmbiguousIdentity(request) {
  const words = normalizeArabicAuthorName(request.canonical).split(' ').filter(Boolean)
  if (words.length < 2) return true
  if (/^ابو\s+(عبد الله|محمد|احمد|يحيى|يوسف|سليمان|حفص|مصعب|هاجر)$/u.test(normalizeArabicAuthorName(request.canonical))) return true
  return /^(مصطفى|احمد|عاصم|عبد الله)\b/u.test(normalizeArabicAuthorName(request.canonical)) && words.length < 3
}

export function mergeHighConfidence(existing, additions) {
  const output = [...existing]
  const identities = new Set(existing.flatMap(author => [author.name, ...(author.aliases ?? [])]).map(normalizeArabicAuthorName))
  for (const author of additions) {
    const names = [author.name, ...(author.aliases ?? [])].map(normalizeArabicAuthorName)
    if (names.some(name => identities.has(name))) continue
    output.push(author)
    names.forEach(name => identities.add(name))
  }
  return output
}
