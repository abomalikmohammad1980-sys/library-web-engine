import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { convertShamelaSqliteBook, writeArtifactAtomic } from './shamela-sqlite-converter.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'shamela-converter-')), input = join(root, 'input'), output = join(root, 'output.json')
  await mkdir(input)
  const master = join(input, 'master.db'), book = join(input, '77.db')
  let db = new DatabaseSync(master)
  db.exec(`
    CREATE TABLE author (author_id INTEGER PRIMARY KEY, author_name TEXT, death_number INTEGER, death_text TEXT, alpha INTEGER);
    CREATE TABLE author_book (author_id INTEGER, book_id INTEGER);
    CREATE TABLE book (book_id INTEGER PRIMARY KEY, book_name TEXT, book_category INTEGER, book_type INTEGER, book_date INTEGER, authors TEXT, main_author INTEGER, printed INTEGER, group_id INTEGER, hidden INTEGER, major_online INTEGER, minor_online INTEGER, major_ondisk INTEGER, minor_ondisk INTEGER, pdf_links TEXT, pdf_ondisk INTEGER, pdf_online INTEGER, cover_ondisk INTEGER, cover_online INTEGER, meta_data TEXT, parent INTEGER, alpha INTEGER, group_order INTEGER, book_up INTEGER);
    CREATE TABLE category (category_id INTEGER PRIMARY KEY, category_name TEXT, category_order INTEGER);
    CREATE TABLE coauthor_book (author_id INTEGER, book_id INTEGER);
    INSERT INTO author VALUES (8,'مؤلفٌ مُشكَّل',700,'ت ٧٠٠ هـ\nسطر ثان',1);
    INSERT INTO author_book VALUES (8,77);
    INSERT INTO category VALUES (4,'فنّ دقيق',2);
    INSERT INTO book VALUES (77,'عنوان\r\nالكتاب',4,1,700,'8',8,1,NULL,0,1,0,1,0,NULL,NULL,NULL,NULL,NULL,'{"raw":"قيمة  "}',NULL,1,NULL,NULL);
  `); db.close()
  db = new DatabaseSync(book)
  db.exec(`
    CREATE TABLE page (id INTEGER PRIMARY KEY, part TEXT, page INTEGER, number INTEGER, services TEXT);
    CREATE TABLE title (id INTEGER PRIMARY KEY, page INTEGER, parent INTEGER);
    INSERT INTO page VALUES (1,'١\n',4,NULL,'نصٌّ كما هو  \r\n');
    INSERT INTO page VALUES (2,NULL,5,9,NULL);
    INSERT INTO title VALUES (10,1,0);
    INSERT INTO title VALUES (11,2,10);
  `); db.close()
  return { root, master, book, output }
}

describe('shamela sqlite converter experimental phase 1', () => {
  it('preserves all mapped metadata/page/title fields and text exactly with provenance', async () => {
    const { root, master, book } = await fixture()
    const artifact = await convertShamelaSqliteBook({ projectRoot: root, masterPath: master, bookPath: book })
    assert.equal(artifact.workId, 'shamela4_1:77')
    assert.equal(artifact.metadata.bookName, 'عنوان\r\nالكتاب')
    assert.equal(artifact.metadata.metaDataRaw, '{"raw":"قيمة  "}')
    assert.equal(artifact.authors[0].authorName, 'مؤلفٌ مُشكَّل')
    assert.equal(artifact.pages[0].part, '١\n')
    assert.equal(artifact.pages[0].services, 'نصٌّ كما هو  \r\n')
    assert.deepEqual(artifact.titles, [
      { sourceRowId: '10', sequence: 0, pageSourceRowId: '1', parentSourceRowId: null },
      { sourceRowId: '11', sequence: 1, pageSourceRowId: '2', parentSourceRowId: '10' },
    ])
    assert.deepEqual(artifact.counts, { metadataRows: 1, authors: 1, categoryRows: 1, pages: 2, titles: 2 })
    assert.equal(artifact.integrity.textPreserved, true)
    assert.deepEqual(artifact.integrity.sourceText, artifact.integrity.roundTripText)
    assert.equal(artifact.provenance.inputs.every(input => /^[0-9a-f]{64}$/.test(input.sha256) && /^[0-9a-f]{64}$/.test(input.schemaFingerprint)), true)
    assert.equal(artifact.provenance.inputs.some(input => input.logicalPath.includes('\\')), false)
  })

  it('writes one atomic artifact and refuses to overwrite it', async () => {
    const { root, master, book, output } = await fixture()
    const artifact = await convertShamelaSqliteBook({ projectRoot: root, masterPath: master, bookPath: book })
    const written = await writeArtifactAtomic(root, output, artifact)
    assert.equal(JSON.parse(await readFile(output, 'utf8')).integrity.payloadSha256, artifact.integrity.payloadSha256)
    assert.equal(written.logicalPath, 'output.json')
    await assert.rejects(writeArtifactAtomic(root, output, artifact))
  })

  it('fails closed on schema drift, missing identity and paths outside the project', async () => {
    const { root, master, book } = await fixture()
    const scoped = join(root, 'scoped'); await mkdir(scoped)
    await assert.rejects(convertShamelaSqliteBook({ projectRoot: scoped, masterPath: master, bookPath: book }), /converter_path_outside_project/)
    let db = new DatabaseSync(book); db.exec('ALTER TABLE page ADD COLUMN invented TEXT'); db.close()
    await assert.rejects(convertShamelaSqliteBook({ projectRoot: root, masterPath: master, bookPath: book }), /converter_mapping_columns_mismatch/)
  })
})
