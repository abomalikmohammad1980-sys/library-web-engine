import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSourceDocumentTitle } from './translation'
import { uiDictionary } from './ui_dictionary_loader'

describe('translated route document title', () => {
  beforeAll(async () => {
    await uiDictionary.ready()
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

  it('replaces the previous translated route title with the current route title', async () => {
    localStorage.setItem('khizana:site-language', 'en')
    setSourceDocumentTitle('الرئيسية — الخِزانة')
    await vi.waitFor(() => expect(document.title).toBe('Home - Al-Khezana'))

    setSourceDocumentTitle('القرآن — الخِزانة')
    await vi.waitFor(() => expect(document.title).toBe('Quran - Al-Khezana'))
  })

  it('keeps an Arabic book name while translating the known reader suffix', async () => {
    localStorage.setItem('khizana:site-language', 'en')
    setSourceDocumentTitle('تفسير السعدي — قراءة — الخِزانة')
    await vi.waitFor(() => expect(document.title).toContain('Tafsir al-Sa‘di'))
    expect(document.title).not.toContain('Home')
  })
})
