import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connectAppSourceSync } from './source_sync_ui'
import { currentReadingData } from './reading_data'

describe('phase 7 local privacy and leakage gate', () => {
  beforeEach(() => { const values = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }); vi.stubGlobal('document', { documentElement: { style: { setProperty: vi.fn() }, classList: { toggle: vi.fn() } } }) })
  it.each(['signedOut', 'guest'] as const)('%s never reads token or invokes network client', async kind => { const token = vi.fn(async () => 'secret'); const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy); await connectAppSourceSync({ identity: () => ({ kind }), baseUrl: 'https://sync.invalid/', bookId: 'b', deviceId: 'd', token }, () => {}); expect(token).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled() })
  it('reading JSON excludes tokens, portraits, book text and binary artifacts', () => { const text = JSON.stringify(currentReadingData(new Date(0))); for (const forbidden of ['token', 'authorization', 'imageData', 'sourceData', 'pdfData', 'readerModel', 'paragraphs']) expect(text).not.toContain(forbidden) })
  it('logs only stable codes/counts, not error messages, filenames, content or absolute paths', () => { const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8'), dom = readFileSync(new URL('./engine/dom_render.ts', import.meta.url), 'utf8'); expect(reader).not.toMatch(/console\.(?:warn|log)\([^\n]*(?:fileName|family|\.message|, e\))/); expect(dom).toContain("console.warn('word_page_map_mismatch', audit.mismatches.length)"); expect(`${reader}\n${dom}`).not.toMatch(/[A-Z]:\\|B:\//) })
  it('keeps full book bytes only in the explicitly named library archive contract', () => { const reading = readFileSync(new URL('./reading_data.ts', import.meta.url), 'utf8'), archive = readFileSync(new URL('./library_archive.ts', import.meta.url), 'utf8'); expect(reading).not.toContain('sourceData'); expect(reading).not.toContain('pdfData'); expect(archive).toContain('original-'); expect(archive).toContain('pdfPath') })
})
