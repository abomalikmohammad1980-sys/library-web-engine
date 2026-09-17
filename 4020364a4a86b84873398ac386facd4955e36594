import { describe, expect, it } from 'vitest'
import { decodeUtf8Text, textParagraphs, textTitleFromFileName } from './text_import'
describe('UTF-8 text books', () => {
  it('decodes and groups Arabic paragraphs without changing content', () => { const text = decodeUtf8Text(new TextEncoder().encode('\uFEFFمقدمة\r\n\r\nنص عربي')); expect(text).toBe('مقدمة\n\nنص عربي'); expect(textParagraphs(text)).toEqual(['مقدمة', 'نص عربي']) })
  it('rejects invalid UTF-8 and derives a title', () => { expect(() => decodeUtf8Text(new Uint8Array([0xc3, 0x28]))).toThrow('UTF-8'); expect(textTitleFromFileName('فقه_النوازل.txt')).toBe('فقه النوازل') })
})
