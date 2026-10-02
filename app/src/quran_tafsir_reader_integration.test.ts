import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { loadLocalTafsir } from './quran_tafsir_pack'
import { MAX_TEXT_BYTES, storedTextSource } from './text_import'
import { isTextualReaderFormat } from './book_format'

const SCREEN = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
const REGISTRY = readFileSync(new URL('./quran_tafsir_registry.ts', import.meta.url), 'utf8')
const LIBRARY = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
const READER = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const MANIFEST = JSON.parse(readFileSync(new URL('../public/library/published/manifest.json', import.meta.url), 'utf8')) as { works: { id: string; sources: { format: string }[] }[] }

describe('local tafsir reader integration', () => {
  it('opens every verified local tafsir as a navigable reader book', () => {
    expect(REGISTRY).toContain("author: 'محمد بن جرير الطبري'")
    expect(REGISTRY).toContain("author: 'الحسين بن مسعود البغوي'")
    expect(REGISTRY).toContain("author: 'عبد الرحمن بن ناصر السعدي'")
    expect(REGISTRY).toContain("author: 'مركز تفسير للدراسات القرآنية'")
    expect(REGISTRY).toContain("author: 'إسماعيل بن عمر ابن كثير'")
    expect(REGISTRY).toContain("author: 'محمد الأمين الشنقيطي'")
    expect(REGISTRY).toContain("author: 'سيد قطب'")
    expect(SCREEN).toContain('tafsirReaderHref(definition, record.surah, record.ayah)')
    expect(SCREEN).toContain('getSourceEditionBookLink(definition.slug,record.surah,record.ayah)')
    expect(SCREEN).toContain('sourceBookLink?.href')
    expect(SCREEN).toContain('routeLocation.hash = tafsirReaderHref(redirectDefinition')
    expect(LIBRARY).not.toContain('linkedTafsirBooks')
    expect(READER).toContain('ensurePublishedWorkSeeded(id)')
    expect(READER).toContain('isTextualReaderFormat(inferBookFormat(stored))')
    expect(isTextualReaderFormat('markdown')).toBe(true)
    expect(MANIFEST.works.filter(work => work.id.startsWith('tafsir-')&&!work.id.startsWith('tafsir-shuoun-'))).toHaveLength(8)
  })

  it('does not re-apply the user import ceiling to a verified large tafsir', () => {
    const verifiedText = '# تفسير محلي كبير\n\nمادة التفسير الموثقة'
    const bytes = new Uint8Array(MAX_TEXT_BYTES + 1)
    expect(storedTextSource(bytes, verifiedText)).toBe(verifiedText)
    expect(() => storedTextSource(bytes)).toThrow(/20/)
    expect(READER).toContain('storedTextSource(stored.data, stored.extractedText)')
  })

  it('offers the common selection and book-card tools without remote tafsir links', () => {
    for (const label of ['نسخ', 'ترجمة', 'تظليل', 'في الخزانة', 'في Google']) expect(SCREEN).toContain(label)
    expect(SCREEN).toContain("addHighlight(`quran-tafsir-${slug}`")
    expect(SCREEN).toContain('loadLocalTafsir(definition.slug, record.surah, record.ayah, retry)')
    expect(SCREEN).not.toContain('quranpedia.net/tafsir')
  })

  it('loads a legacy local tafsir through the shared loader rather than a screen-owned fetch', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ name: 'تفسير الطبري',
      segments: [{ from: 1, to: 1, text: 'نص تفسير محلي صالح' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const reading = await loadLocalTafsir('tabari', 1, 1, true)
    expect(reading).toMatchObject({ title: 'تفسير الطبري', html: 'نص تفسير محلي صالح', hasDirectCommentary: true })
    expect(fetcher).toHaveBeenCalledWith('./quran/tafsir/tabari/1.json',
      { credentials: 'same-origin', cache: 'reload' })
  })

  it('treats a valid sparse tafsir verse as unaddressed rather than a load failure', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ name: 'أضواء البيان',
      segments: [{ from: 2, to: 2, text: 'تفسير الآية الثانية' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(loadLocalTafsir('adwa-al-bayan', 1, 1, true)).resolves.toMatchObject({
      title: 'أضواء البيان', html: '', hasDirectCommentary: false,
    })
    await expect(loadLocalTafsir('adwa-al-bayan', 1, 2, true)).resolves.toMatchObject({
      html: 'تفسير الآية الثانية', hasDirectCommentary: true,
    })
  })

  it('keeps real tafsir transport and schema failures fail-closed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    await expect(loadLocalTafsir('adwa-al-bayan', 1, 1, true)).rejects.toThrow('quran-tafsir-legacy-http-404')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'أضواء البيان' }), { status: 200 })))
    await expect(loadLocalTafsir('adwa-al-bayan', 1, 1, true)).rejects.toThrow('quran-tafsir-legacy-invalid')
  })

  it('loads Adwa al-Bayan at the beginning, middle, and end and resolves its full book', async () => {
    const publicRoot = new URL('../public/', import.meta.url)
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const relative = String(input).replace(/^\.\//, '')
      const source = new URL(relative, publicRoot)
      return existsSync(source) ? new Response(readFileSync(source), { status: 200 }) : new Response('', { status: 404 })
    }))

    const beginning = await loadLocalTafsir('adwa-al-bayan', 1, 1, true)
    const middle = await loadLocalTafsir('adwa-al-bayan', 57, 29, true)
    const end = await loadLocalTafsir('adwa-al-bayan', 114, 6, true)
    expect(beginning).toMatchObject({ hasDirectCommentary: false, html: '' })
    expect(middle.hasDirectCommentary).toBe(true)
    expect(middle.html.length).toBeGreaterThan(20)
    expect(end).toMatchObject({ hasDirectCommentary: false, html: '' })

    const work = MANIFEST.works.find(candidate => candidate.id === 'tafsir-adwa-al-bayan')
    expect(work?.sources[0]?.format).toBe('markdown')
    const manifest = JSON.parse(readFileSync(new URL('../public/library/published/manifest.json', import.meta.url), 'utf8')) as {
      works: Array<{ id: string; status: string; sources: Array<{ path: string }> }>
    }
    const canonical = manifest.works.find(candidate => candidate.id === 'tafsir-adwa-al-bayan')
    expect(canonical?.status).toBe('ready')
    expect(canonical?.sources[0]?.path).toBeTruthy()
    expect(existsSync(new URL(`../public/${canonical!.sources[0].path.replace(/^\.\//, '')}`, import.meta.url))).toBe(true)
    expect(SCREEN).toContain('tafsirReaderHref(definition, record.surah, record.ayah)')
  })

  it('loads Fi Zilal al-Quran from its explicit BOK ranges and opens the same canonical book', async () => {
    const publicRoot = new URL('../public/', import.meta.url)
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const source = new URL(String(input).replace(/^\.\//, ''), publicRoot)
      return existsSync(source) ? new Response(readFileSync(source), { status: 200 }) : new Response('', { status: 404 })
    }))
    for (const [surah, ayah] of [[1, 1], [57, 15], [114, 6]]) {
      const reading = await loadLocalTafsir('fi-zilal', surah!, ayah!, true)
      expect(reading.hasDirectCommentary, `${surah}:${ayah}`).toBe(true)
      expect(reading.html.length, `${surah}:${ayah}`).toBeGreaterThan(100)
    }
    const manifest = JSON.parse(readFileSync(new URL('../public/library/published/manifest.json', import.meta.url), 'utf8')) as {
      works: Array<{ id: string; status: string; sources: Array<{ path: string; format: string; sha256: string }> }>
    }
    const work = manifest.works.find(candidate => candidate.id === 'tafsir-fi-zilal')
    expect(work).toMatchObject({ status: 'ready', sources: [{ format: 'shamela-bok', sha256: '8aec169b5904d137e11dcb9c46a18dc74623dfcb7b5befea668eefd25632a0c6' }] })
    expect(existsSync(new URL(`../public/${work!.sources[0].path.replace(/^\.\//, '')}`, import.meta.url))).toBe(true)
    expect(REGISTRY).toContain("workId: 'tafsir-fi-zilal'")
  })
})
