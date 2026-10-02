import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PublishedLibraryManifest } from './published_library_seed'

const publicRoot = new URL('../public/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('library/published/manifest.json', publicRoot), 'utf8')) as PublishedLibraryManifest

describe('published dataset properties', () => {
  it('keeps every ready work addressable with unique identity and a supported format', () => {
    expect(manifest.works.length).toBeGreaterThanOrEqual(26); expect(manifest.readyCount).toBe(manifest.works.length)
    expect(new Set(manifest.works.map(work => work.id)).size).toBe(manifest.works.length)
    const fingerprints = manifest.works.map(work => `${work.title.normalize('NFKC').trim()}|${work.author.normalize('NFKC').trim()}|${work.metadata.edition ?? ''}`)
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
    const formats = new Set(manifest.works.flatMap(work => work.sources.map(source => source.format)))
    expect(formats).toEqual(new Set(['word', 'pdf', 'epub', 'shamela-bok', 'markdown']))
    const worksByFormat = (format: string): number => manifest.works.filter(work => work.sources.some(source => source.format === format)).length
    // خط الأساس، ثم 9 أزواج Word/PDF و4 fallbacks (أحدها فقط معه PDF أصلي).
    expect({ word: worksByFormat('word'), pdf: worksByFormat('pdf'), bok: worksByFormat('shamela-bok'), epub: worksByFormat('epub') })
      .toEqual({ word: 19, pdf: 25, bok: 6, epub: 3 })
    for (const work of manifest.works) {
      expect(work.status).toBe('ready'); expect(work.security.verdict).toBe('allow')
      expect(work.title.trim()).not.toBe(''); expect(work.author.trim()).not.toBe('')
      expect(work.sources.length).toBeGreaterThan(0)
    }
    const testWorks = manifest.works.filter(work => work.id.startsWith('test-'))
    expect(testWorks).toHaveLength(13)
    expect(testWorks.every(work => work.metadata.category === 'غير مصنف' && work.author !== 'غير معروف')).toBe(true)
  })

  it('verifies every published byte source by size, signature and sha256', () => {
    for (const source of manifest.works.flatMap(work => work.sources)) {
      const url = new URL(source.path.replace(/^\.\//, ''), publicRoot), bytes = readFileSync(url)
      expect(statSync(url).size).toBe(source.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256)
      const extension = extname(source.fileName).toLowerCase()
      if (source.format === 'pdf') expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
      if (source.format === 'word' || source.format === 'epub') expect(bytes.subarray(0, 2).toString('ascii')).toBe('PK')
      if (source.format === 'shamela-bok') expect(extension).toBe('.bok')
      if (source.format === 'markdown') expect(extension).toBe('.md')
    }
  })

  it('keeps Word/PDF pairs grouped and every Word source authoritative', () => {
    const wordWorks = manifest.works.filter(item => item.sources.some(source => source.format === 'word'))
    expect(wordWorks).toHaveLength(19)
    expect(manifest.works.filter(item => !item.sources.some(source => source.format === 'word') && item.wordArtifact)).toEqual([])
    for (const work of wordWorks) {
      expect(Boolean(work.wordArtifact) !== Boolean(work.wordFallback)).toBe(true)
      if (work.wordArtifact) {
        expect(work.sources.some(source => source.format === 'word')).toBe(true)
        expect(work.wordArtifact.totalPages).toBeGreaterThan(0)
        const map = JSON.parse(readFileSync(new URL(work.wordArtifact.path.replace(/^\.\//, ''), publicRoot), 'utf8')) as { totalPages: number; paragraphCount: number }
        expect(map.totalPages).toBe(work.wordArtifact.totalPages)
        expect(map.paragraphCount).toBe(work.wordArtifact.paragraphCount)
      } else {
        expect(work.wordFallback?.paragraphCount).toBeGreaterThan(0)
        expect(work.wordArtifact).toBeUndefined()
      }
    }
  })
})
