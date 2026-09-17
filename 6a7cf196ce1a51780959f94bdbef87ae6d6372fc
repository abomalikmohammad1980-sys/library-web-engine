import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSourceDocumentTitle } from './translation'

describe('translated route document title', () => {
  beforeAll(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    })
    vi.stubGlobal('document', {
      documentElement: { lang: 'ar' },
      title: '',
    })
  })

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = 'ar'
    document.title = ''
  })

  it('replaces the previous translated route title with the current route title', () => {
    localStorage.setItem('khizana:site-language', 'en')
    setSourceDocumentTitle('الرئيسية — الخِزانة')
    expect(document.title).toBe('Home — Al-Khezana')

    setSourceDocumentTitle('القرآن — الخِزانة')
    expect(document.title).toBe('Quran — Al-Khezana')
  })

  it('keeps an Arabic book name while translating the known reader suffix', () => {
    localStorage.setItem('khizana:site-language', 'en')
    setSourceDocumentTitle('تفسير السعدي — قراءة — الخِزانة')
    expect(document.title).toContain('Tafsir al-Sa‘di')
    expect(document.title).not.toContain('Home')
  })
})
