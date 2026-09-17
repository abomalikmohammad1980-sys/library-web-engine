import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SCREEN = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
const LIBRARY = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
const READER = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const MANIFEST = JSON.parse(readFileSync(new URL('../public/library/published/manifest.json', import.meta.url), 'utf8')) as { works: { id: string; sources: { format: string }[] }[] }

describe('local tafsir reader integration', () => {
  it('opens the four verified local tafsirs as navigable reader books', () => {
    expect(SCREEN).toContain("author: 'محمد بن جرير الطبري'")
    expect(SCREEN).toContain("author: 'الحسين بن مسعود البغوي'")
    expect(SCREEN).toContain("author: 'عبد الرحمن بن ناصر السعدي'")
    expect(SCREEN).toContain("author: 'مركز تفسير للدراسات القرآنية'")
    expect(SCREEN).toContain('href: `#/reader/tafsir-${definition.slug}?surah=${record.surah}&ayah=${record.ayah}`')
    expect(SCREEN).toContain('location.hash = `#/reader/tafsir-${redirectDefinition.slug}`')
    expect(LIBRARY).not.toContain('linkedTafsirBooks')
    expect(READER).toContain('ensurePublishedWorkSeeded(id)')
    expect(READER).toContain("inferBookFormat(stored) === 'markdown'")
    expect(MANIFEST.works.filter(work => work.id.startsWith('tafsir-') && work.sources[0]?.format === 'markdown')).toHaveLength(4)
  })

  it('offers the common selection and book-card tools without remote tafsir links', () => {
    for (const label of ['نسخ', 'ترجمة', 'تظليل', 'في الخزانة', 'في Google']) expect(SCREEN).toContain(label)
    expect(SCREEN).toContain("addHighlight(`quran-tafsir-${slug}`")
    expect(SCREEN).toContain("fetch(`./quran/tafsir/${definition.slug}/${record.surah}.json`)")
    expect(SCREEN).not.toContain('quranpedia.net/tafsir')
  })
})
