import { describe, expect, it } from 'vitest'
import { applyBookWordReplacement, CURRENT_READER_MODEL_VERSION, hasCurrentReaderModel, mergeAuthorRecords, persistAndVerifyReaderPageCount, restoreBookMetadataSnapshot, sha256Hex, snapshotBookMetadata, type StoredAuthor, type StoredBook } from './library_store'

describe('library original file integrity', () => {
  it('invalidates version 5 cached models after numeric text and spacing repairs', () => {
    expect(CURRENT_READER_MODEL_VERSION).toBeGreaterThan(5)
    expect(hasCurrentReaderModel({ readerModel: {} as StoredBook['readerModel'], readerModelVersion: 5 })).toBe(false)
  })
  it('rejects a persisted OOXML model from before the header/footer/footnote contract', () => {
    const model = {} as StoredBook['readerModel']
    expect(hasCurrentReaderModel({ readerModel: model })).toBe(false)
    expect(hasCurrentReaderModel({ readerModel: model, readerModelVersion: CURRENT_READER_MODEL_VERSION - 1 })).toBe(false)
    expect(hasCurrentReaderModel({ readerModel: model, readerModelVersion: CURRENT_READER_MODEL_VERSION })).toBe(true)
  })

  it('computes a stable SHA-256 for the unchanged uploaded bytes', async () => {
    const bytes = new TextEncoder().encode('DOCX original bytes')
    expect(await sha256Hex(bytes)).toBe('5c7bfff4ed2eca3cd84f4b7f7e53f183f6b9fe398690575bb6b97f375c06bab0')
    expect([...bytes]).toEqual([...new TextEncoder().encode('DOCX original bytes')])
  })

  it('keeps metadata and invalidates every derivative when Word is replaced', () => {
    const book = { id: 'b', title: 'العنوان', author: 'المؤلف', category: 'فقه', fileName: 'old.docx',
      fileSize: 10, addedAt: 1, data: new Uint8Array([1]), mimeType: 'docx', originalSha256: 'old',
      pdfData: new Uint8Array([2]), pdfFileName: 'old.pdf', pdfEngine: 'old', pdfStatus: 'ready',
      wordPageMap: { totalPages: 9, paragraphCount: 0, starts: [] }, readerModel: {}, readerModelVersion: CURRENT_READER_MODEL_VERSION } as unknown as StoredBook
    applyBookWordReplacement(book, { fileName: 'new.docx', data: new Uint8Array([3, 4]), mimeType: 'docx' }, 'newhash')
    expect({ title: book.title, author: book.author, category: book.category }).toEqual({ title: 'العنوان', author: 'المؤلف', category: 'فقه' })
    expect(book.fileName).toBe('new.docx'); expect(book.originalSha256).toBe('newhash')
    expect(book.pdfStatus).toBe('pending'); expect(book.pdfData).toBeUndefined()
    expect(book.pdfEngine).toBeUndefined(); expect(book.wordPageMap).toBeUndefined(); expect(book.readerModel).toBeUndefined(); expect(book.readerModelVersion).toBeUndefined()
  })
})

describe('reader physical page count persistence', () => {
  it('updates and reloads an old record with map 72 and physical reader count 73', async () => {
    const records = new Map<string, StoredBook>([['old', {
      id: 'old', title: 'كتاب', author: 'مؤلف', fileName: 'old.docx', fileSize: 1, addedAt: 1,
      data: new Uint8Array([1]), mimeType: 'docx', originalSha256: 'x', pdfStatus: 'pending',
      wordPageMap: { totalPages: 72, paragraphCount: 0, starts: [] },
    }]])
    await persistAndVerifyReaderPageCount('old', 73,
      async (id, count) => { records.set(id, { ...records.get(id)!, readerPageCount: count }) },
      async id => records.get(id),
    )
    const reloaded = records.get('old')!
    expect(reloaded.wordPageMap?.totalPages).toBe(72)
    expect(reloaded.readerPageCount).toBe(73)
  })
})

describe('author catalog merge', () => {
  it('keeps the primary identity and preserves unique data and aliases from both records', () => {
    const base = { id: 'a1', name: 'إبراهيم القوصي', canonicalName: 'ابراهيم القوصي', aliases: ['خبيب السوداني'], country: 'السودان', works: ['أ'], createdAt: 20, updatedAt: 30 } as StoredAuthor
    const duplicate = { id: 'a2', name: 'إبراهيم القوصي السوداني', canonicalName: 'ابراهيم القوصي السوداني', aliases: ['الشيخ إبراهيم'], biography: 'ترجمة موثقة', works: ['أ', 'ب'], shamelaBooks: [{ id: '7', title: 'كتاب' }], createdAt: 10, updatedAt: 40 } as StoredAuthor
    const merged = mergeAuthorRecords(base, duplicate, 50)
    expect({ id: merged.id, name: merged.name, country: merged.country, biography: merged.biography }).toEqual({ id: 'a1', name: 'إبراهيم القوصي', country: 'السودان', biography: 'ترجمة موثقة' })
    expect(merged.aliases).toEqual(['خبيب السوداني', 'إبراهيم القوصي السوداني', 'الشيخ إبراهيم'])
    expect(merged.works).toEqual(['أ', 'ب'])
    expect(merged.shamelaBooks).toEqual([{ id: '7', title: 'كتاب' }])
    expect(merged.createdAt).toBe(10); expect(merged.updatedAt).toBe(50)
  })
})

describe('bulk metadata undo snapshots', () => {
  it('restores heterogeneous author/category/era metadata exactly after apply and reload', () => {
    const book = (id: string, values: Partial<StoredBook>) => ({ id, title: id, author: 'قديم', fileName: `${id}.docx`, fileSize: 1, addedAt: 1, data: new Uint8Array([1]), mimeType: 'docx', originalSha256: id, pdfStatus: 'pending', ...values }) as StoredBook
    const records = [
      book('a', { authorId: 'author-a', category: 'فقه', contemporary: false, deathYearHijri: 300 }),
      book('b', { author: 'معاصر', contemporary: true }),
    ]
    const snapshots = records.map(snapshotBookMetadata)
    records.forEach(item => { item.author = 'موحد'; item.category = 'علوم أخرى'; item.contemporary = true; delete item.deathYearHijri })
    records.forEach((item, index) => restoreBookMetadataSnapshot(item, snapshots[index]!))
    expect(records.map(snapshotBookMetadata)).toEqual(snapshots)
    expect(records[1].category).toBeUndefined()
    expect(records[0]).toMatchObject({ authorId: 'author-a', category: 'فقه', contemporary: false, deathYearHijri: 300 })
  })
})
