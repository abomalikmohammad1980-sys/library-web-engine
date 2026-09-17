export interface CatalogCsvBook {
  id: string; title: string; author: string; category?: string; deathYearHijri?: number; contemporary?: boolean
  publisher?: string; edition?: string; investigator?: string; publicationYearHijri?: number; fileName: string
  seriesName?: string; seriesOrder?: number
}

const formulaSafe = (value: string): string => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
const cell = (value: unknown): string => `"${formulaSafe(String(value ?? '').replace(/\r?\n/g, ' ')).replace(/"/g, '""')}"`
const decodeCell = (value: string): string => /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value
export const CATALOG_CSV_LIMITS = { bytes: 16 * 1024 * 1024, rows: 50_000, columns: 64, cellCharacters: 1_000_000 } as const

export function libraryCatalogCsv(books: readonly CatalogCsvBook[]): string {
  const header = ['المعرف', 'العنوان', 'المؤلف', 'التصنيف', 'حالة المؤلف', 'الوفاة هـ', 'الناشر', 'الطبعة', 'المحقق', 'سنة النشر هـ', 'السلسلة', 'الترتيب في السلسلة', 'اسم الملف']
  const rows = [...books].sort((a, b) => a.title.localeCompare(b.title, 'ar')).map(book => [
    book.id, book.title, book.author, book.category ?? '', book.contemporary ? 'معاصر' : 'متوفى', book.deathYearHijri ?? '',
    book.publisher ?? '', book.edition ?? '', book.investigator ?? '', book.publicationYearHijri ?? '', book.seriesName ?? '', book.seriesOrder ?? '', book.fileName,
  ])
  return `\uFEFF${[header, ...rows].map(row => row.map(cell).join(',')).join('\r\n')}\r\n`
}

export interface CatalogMetadataImport { id: string; title: string; author: string; category: string | null; contemporary: boolean; deathYearHijri?: number; publisher: string; edition: string; investigator: string; publicationYearHijri?: number; seriesName: string; seriesOrder: number | null }

export function parseLibraryCatalogCsv(source: string): CatalogMetadataImport[] {
  if (source.length > CATALOG_CSV_LIMITS.bytes) throw new Error('حجم CSV يتجاوز الحد الآمن')
  const rows = parseRows(source.replace(/^\uFEFF/, '')); if (!rows.length) return []
  if (rows.length - 1 > CATALOG_CSV_LIMITS.rows) throw new Error('عدد سجلات CSV يتجاوز الحد الآمن')
  if (rows.some(row => row.length > CATALOG_CSV_LIMITS.columns || row.some(value => value.length > CATALOG_CSV_LIMITS.cellCharacters))) throw new Error('بنية CSV تتجاوز الحد الآمن')
  const header = rows[0]!, at = (name: string): number => header.indexOf(name)
  for (const required of ['المعرف', 'العنوان', 'المؤلف']) if (at(required) < 0) throw new Error(`عمود «${required}» مفقود`)
  const value = (row: string[], name: string): string => at(name) < 0 ? '' : decodeCell((row[at(name)] ?? '').trim())
  const parsed = rows.slice(1).filter(row => value(row, 'المعرف')).map(row => {
    const death = Number(value(row, 'الوفاة هـ')), year = Number(value(row, 'سنة النشر هـ')), order = Number(value(row, 'الترتيب في السلسلة'))
    return { id: value(row, 'المعرف'), title: value(row, 'العنوان'), author: value(row, 'المؤلف'), category: value(row, 'التصنيف') || null, contemporary: value(row, 'حالة المؤلف') === 'معاصر', ...(death > 0 ? { deathYearHijri: death } : {}), publisher: value(row, 'الناشر'), edition: value(row, 'الطبعة'), investigator: value(row, 'المحقق'), ...(year > 0 ? { publicationYearHijri: year } : {}), seriesName: value(row, 'السلسلة'), seriesOrder: order > 0 ? order : null }
  }).filter(row => row.title && row.author)
  const ids = new Set<string>()
  for (const row of parsed) { if (ids.has(row.id)) throw new Error(`معرف الكتاب «${row.id}» مكرر في CSV`); ids.add(row.id) }
  return parsed
}

function parseRows(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < source.length; i++) { const char = source[i]!; if (char === '"') { if (quoted && source[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted } else if (char === ',' && !quoted) { row.push(cell); cell = '' } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && source[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = '' } else cell += char }
  row.push(cell); if (row.some(Boolean)) rows.push(row); return rows
}
