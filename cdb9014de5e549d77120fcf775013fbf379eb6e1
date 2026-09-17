import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  HADEETHENC_AR_SOURCE,
  validateSunnahCorpusManifest,
  validateSunnahGoldenRecord,
  type SunnahCorpusManifest,
  type SunnahGoldenRecord,
} from './sunnah_source_registry'

const corpusRoot = new URL('../public/sunnah/hadeethenc-ar/', import.meta.url)
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')
const recordPayload = (record: SunnahGoldenRecord) => ({
  id: record.id,
  title: record.title,
  hadithText: record.hadithText,
  explanation: record.explanation,
  wordMeanings: record.wordMeanings,
  benefits: record.benefits,
  grade: record.grade,
  takhrij: record.takhrij,
  link: record.link,
})

describe('HadeethEnc Arabic golden corpus', () => {
  it('pins the official release and verifies every bundled record', async () => {
    const manifest = JSON.parse(await readFile(new URL('manifest.json', corpusRoot), 'utf8')) as SunnahCorpusManifest
    const recordsText = await readFile(new URL('records.golden.json', corpusRoot), 'utf8')
    const records = JSON.parse(recordsText) as SunnahGoldenRecord[]

    expect(validateSunnahCorpusManifest(manifest, HADEETHENC_AR_SOURCE)).toEqual([])
    expect(records).toHaveLength(30)
    expect(new Set(records.map(record => record.id)).size).toBe(records.length)
    expect(sha256(recordsText)).toBe(manifest.records.checksumSha256)
    for (const record of records) {
      expect(validateSunnahGoldenRecord(record)).toEqual([])
      expect(record.provenance.recordChecksumSha256).toBe(sha256(JSON.stringify(recordPayload(record))))
    }
  })

  it('fails closed for a changed release, expanded sample, or mismatched link', async () => {
    const manifest = JSON.parse(await readFile(new URL('manifest.json', corpusRoot), 'utf8')) as SunnahCorpusManifest
    expect(validateSunnahCorpusManifest({ ...manifest, release: { ...manifest.release, version: 'v0' } }, HADEETHENC_AR_SOURCE))
      .toContain('إصدار manifest لا يطابق المصدر')
    expect(validateSunnahCorpusManifest({ ...manifest, records: { ...manifest.records, count: 51 } }, HADEETHENC_AR_SOURCE))
      .toContain('عدد سجلات العينة الذهبية غير صالح')

    const [record] = JSON.parse(await readFile(new URL('records.golden.json', corpusRoot), 'utf8')) as SunnahGoldenRecord[]
    expect(validateSunnahGoldenRecord({ ...record!, link: 'https://example.org/not-the-source' }))
      .toContain('رابط الشاهد لا يطابق معرفه في المصدر')
  })
})
