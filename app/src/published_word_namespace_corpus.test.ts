import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadBookFromBuffer } from './engine/bridge'
import { canonicalizeOoxmlPrefixes } from '@engine/ooxml-model'
import { auditWordPageMap, requireWordPageGroups } from './engine/dom_render'

const SANITIZED_IBHAJ = new URL('../public/library/published/assets/7c464cf9b0b1ceb3.docx', import.meta.url)
const IBHAJ_MAP = new URL('../public/library/published/assets/7c464cf9b0b1ceb3.word-page-map.json', import.meta.url)

describe('published Word namespace aliases', () => {
  it('canonicalizes standards-equivalent namespace aliases without changing text', () => {
    const xml = `<ns0:document xmlns:ns0="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><ns0:body><ns0:p/></ns0:body></ns0:document>`
    const normalized = canonicalizeOoxmlPrefixes(xml)
    expect(normalized).toContain('<w:document')
    expect(normalized).toContain('<w:body>')
    expect(normalized).toContain('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"')
    expect(normalized).not.toContain('ns0:')
  })

  it('opens the actual sanitized إبهاج DOCX that uses ns0 instead of w', () => {
    const loaded = loadBookFromBuffer(new Uint8Array(readFileSync(SANITIZED_IBHAJ)))
    const map = JSON.parse(readFileSync(IBHAJ_MAP, 'utf8'))
    expect(loaded.model.paragraphs.length).toBe(190)
    expect(loaded.model.paragraphs.map(paragraph => paragraph.text).join(' ')).toContain('إبهاج أهل الصناعة')
    expect(requireWordPageGroups(loaded.model, map)).toHaveLength(22)
    expect(auditWordPageMap(loaded.model, map).mismatches).toEqual([])
  })
})
