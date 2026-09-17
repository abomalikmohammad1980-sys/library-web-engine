import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadBookFromBuffer } from './engine/bridge'
import { plainReaderGroups } from './reader_failure'

const CAMP = new URL('../../../../كتب للاختبار/منهاج مخيم جيل العزة - المخيم الصيفي لمدة أسبوع.docx', import.meta.url)

describe('QA-012 — منهاج مخيم جيل العزة', () => {
  it('keeps the real DOCX parseable and supplies a non-empty safe reading fallback', () => {
    const bytes = new Uint8Array(readFileSync(CAMP))
    const loaded = loadBookFromBuffer(bytes)
    expect(loaded.model.paragraphs.length).toBeGreaterThan(100)
    const groups = plainReaderGroups(loaded.model.paragraphs)
    expect(groups.length).toBeGreaterThan(1)
    expect(groups.flat().join('')).toMatch(/[\p{Script=Arabic}]/u)
  })
})
