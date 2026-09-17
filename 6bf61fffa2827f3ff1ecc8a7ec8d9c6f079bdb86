#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto'
import { lstat, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { profileShamelaSqlite } from './shamela-sqlite-profiler.mjs'

const CONTRACT = 'shamela4_1-sqlite-artifact/experimental-1'
const MAPPING_ID = 'shamela4_1-observed-master-book-v1'
const REQUIRED = {
  master: {
    book: ['book_id','book_name','book_category','book_type','book_date','authors','main_author','printed','group_id','hidden','major_online','minor_online','major_ondisk','minor_ondisk','pdf_links','pdf_ondisk','pdf_online','cover_ondisk','cover_online','meta_data','parent','alpha','group_order','book_up'],
    author: ['author_id','author_name','death_number','death_text','alpha'],
    author_book: ['author_id','book_id'], coauthor_book: ['author_id','book_id'],
    category: ['category_id','category_name','category_order'],
  },
  book: { page: ['id','part','page','number','services'], title: ['id','page','parent'] },
}
const TEXT_FIELDS = {
  metadata: ['bookName','authorsRaw','pdfLinks','metaDataRaw'],
  author: ['authorName','deathText'], category: ['categoryName'],
  page: ['part','services'], title: [],
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const sqliteHeader = Buffer.from('SQLite format 3\0', 'ascii')
const encode = new TextEncoder()

function within(root, candidate, allowRoot = false) {
  const path = resolve(candidate), rel = relative(root, path)
  if ((!allowRoot && !rel) || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('converter_path_outside_project')
  return { path, logicalPath: rel.split(sep).join('/') }
}
async function sourceFile(root, candidate) {
  const resolved = within(root, candidate), stat = await lstat(resolved.path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('converter_source_not_regular_file')
  const bytes = await readFile(resolved.path)
  if (!bytes.subarray(0, sqliteHeader.length).equals(sqliteHeader)) throw new Error('converter_source_not_sqlite')
  return { ...resolved, byteLength: bytes.byteLength, sha256: sha256(bytes) }
}
function openReadOnly(path) {
  const db = new DatabaseSync(path, { readOnly: true }); db.exec('PRAGMA query_only=ON')
  const integrity = db.prepare('PRAGMA integrity_check').all().map(row => String(Object.values(row)[0]))
  if (integrity.length !== 1 || integrity[0] !== 'ok') { db.close(); throw new Error('converter_sqlite_integrity_failed') }
  return db
}
function validateMapping(database, role) {
  const tables = new Map(database.tables.map(table => [table.name, table]))
  for (const [tableName, expectedColumns] of Object.entries(REQUIRED[role])) {
    const table = tables.get(tableName)
    if (!table) throw new Error(`converter_mapping_table_missing:${role}:${tableName}`)
    const actual = table.columns.map(column => column.name)
    if (actual.length !== expectedColumns.length || actual.some((name, index) => name !== expectedColumns[index])) throw new Error(`converter_mapping_columns_mismatch:${role}:${tableName}`)
  }
}
const plain = row => row == null ? null : Object.fromEntries(Object.entries(row))
const integerOrNull = value => value == null ? null : Number(value)
const stringOrNull = value => value == null ? null : String(value)

function mapMetadata(row) {
  return {
    bookId: String(row.book_id), bookName: stringOrNull(row.book_name), categoryId: row.book_category == null ? null : String(row.book_category),
    bookType: integerOrNull(row.book_type), bookDate: integerOrNull(row.book_date), authorsRaw: stringOrNull(row.authors),
    mainAuthorId: row.main_author == null ? null : String(row.main_author), printed: integerOrNull(row.printed), groupId: row.group_id == null ? null : String(row.group_id),
    hidden: integerOrNull(row.hidden), majorOnline: integerOrNull(row.major_online), minorOnline: integerOrNull(row.minor_online),
    majorOndisk: integerOrNull(row.major_ondisk), minorOndisk: integerOrNull(row.minor_ondisk), pdfLinks: stringOrNull(row.pdf_links),
    pdfOndisk: integerOrNull(row.pdf_ondisk), pdfOnline: integerOrNull(row.pdf_online), coverOndisk: integerOrNull(row.cover_ondisk), coverOnline: integerOrNull(row.cover_online),
    metaDataRaw: stringOrNull(row.meta_data), parentBookId: row.parent == null ? null : String(row.parent), alpha: integerOrNull(row.alpha),
    groupOrder: integerOrNull(row.group_order), bookUp: integerOrNull(row.book_up),
  }
}
function mapAuthor(row, role) { return { role, authorId: String(row.author_id), authorName: stringOrNull(row.author_name), deathNumber: integerOrNull(row.death_number), deathText: stringOrNull(row.death_text), alpha: integerOrNull(row.alpha) } }
function mapCategory(row) { return row ? { categoryId: String(row.category_id), categoryName: stringOrNull(row.category_name), categoryOrder: integerOrNull(row.category_order) } : null }
function mapPage(row, sequence) { return { sourceRowId: String(row.id), sequence, part: stringOrNull(row.part), page: integerOrNull(row.page), number: integerOrNull(row.number), services: stringOrNull(row.services) } }
function mapTitle(row, sequence) { return { sourceRowId: String(row.id), sequence, pageSourceRowId: row.page == null ? null : String(row.page), parentSourceRowId: row.parent == null || Number(row.parent) === 0 ? null : String(row.parent) } }

function textCellsFromArtifact(artifact) {
  const cells = []
  const add = (path, value) => { if (value == null || typeof value === 'string') cells.push([path, value]); else throw new Error(`converter_text_type_invalid:${path}`) }
  for (const field of TEXT_FIELDS.metadata) add(`metadata/${field}`, artifact.metadata[field])
  artifact.authors.forEach((row, index) => TEXT_FIELDS.author.forEach(field => add(`authors/${index}/${field}`, row[field])))
  if (artifact.category) TEXT_FIELDS.category.forEach(field => add(`category/${field}`, artifact.category[field]))
  artifact.pages.forEach((row, index) => TEXT_FIELDS.page.forEach(field => add(`pages/${index}/${field}`, row[field])))
  return cells
}
function textCellsFromSource(rawMetadata, rawAuthors, rawCategory, rawPages) {
  const cells = [], add = (path, value) => cells.push([path, value == null ? null : String(value)])
  for (const [target, source] of [['bookName','book_name'],['authorsRaw','authors'],['pdfLinks','pdf_links'],['metaDataRaw','meta_data']]) add(`metadata/${target}`, rawMetadata[source])
  rawAuthors.forEach(({ row }, index) => { add(`authors/${index}/authorName`, row.author_name); add(`authors/${index}/deathText`, row.death_text) })
  if (rawCategory) add('category/categoryName', rawCategory.category_name)
  rawPages.forEach((row, index) => { add(`pages/${index}/part`, row.part); add(`pages/${index}/services`, row.services) })
  return cells
}
function textIntegrity(cells) {
  const hash = createHash('sha256'); let utf8Bytes = 0, nullCells = 0, textCells = 0, scalarValues = 0
  const put = bytes => { const length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(bytes.byteLength)); hash.update(length); hash.update(bytes) }
  for (const [path, value] of cells) {
    put(encode.encode(path))
    if (value == null) { hash.update(Buffer.from([0])); nullCells++; continue }
    hash.update(Buffer.from([1])); const bytes = encode.encode(value); put(bytes); utf8Bytes += bytes.byteLength; scalarValues += [...value].length; textCells++
  }
  return { cells: cells.length, textCells, nullCells, utf8Bytes, unicodeScalarValues: scalarValues, corpusSha256: hash.digest('hex') }
}

export async function convertShamelaSqliteBook({ projectRoot, masterPath, bookPath, bookId }) {
  const root = resolve(projectRoot), masterSource = await sourceFile(root, resolve(root, masterPath)), bookSource = await sourceFile(root, resolve(root, bookPath))
  const profile = await profileShamelaSqlite({ projectRoot: root, inputs: [masterSource.logicalPath, bookSource.logicalPath], maxFiles: 2 })
  const byPath = new Map(profile.databases.map(database => [database.logicalPath, database]))
  const masterObservation = byPath.get(masterSource.logicalPath), bookObservation = byPath.get(bookSource.logicalPath)
  if (!masterObservation || !bookObservation) throw new Error('converter_profile_missing')
  validateMapping(masterObservation, 'master'); validateMapping(bookObservation, 'book')
  const expectedBookId = String(bookId ?? basename(bookSource.path, '.db'))
  if (!/^\d+$/.test(expectedBookId)) throw new Error('converter_book_id_invalid')
  const master = openReadOnly(masterSource.path), book = openReadOnly(bookSource.path)
  try {
    const rawMetadata = master.prepare('SELECT * FROM book WHERE book_id=?').get(Number(expectedBookId))
    if (!rawMetadata) throw new Error('converter_master_book_missing')
    const metadata = mapMetadata(rawMetadata)
    if (metadata.bookId !== expectedBookId) throw new Error('converter_book_identity_mismatch')
    const links = master.prepare("SELECT author_id,'author' AS role FROM author_book WHERE book_id=? UNION ALL SELECT author_id,'coauthor' AS role FROM coauthor_book WHERE book_id=? ORDER BY role,author_id").all(Number(expectedBookId), Number(expectedBookId))
    const seen = new Set(), authors = [], rawAuthors = []
    for (const link of links) {
      const key = `${link.role}:${link.author_id}`; if (seen.has(key)) continue; seen.add(key)
      const row = master.prepare('SELECT * FROM author WHERE author_id=?').get(link.author_id)
      if (!row) throw new Error('converter_author_reference_missing')
      rawAuthors.push({ row: plain(row), role: String(link.role) }); authors.push(mapAuthor(row, String(link.role)))
    }
    if (metadata.mainAuthorId && !authors.some(author => author.authorId === metadata.mainAuthorId)) {
      const row = master.prepare('SELECT * FROM author WHERE author_id=?').get(Number(metadata.mainAuthorId))
      if (!row) throw new Error('converter_main_author_missing')
      rawAuthors.unshift({ row: plain(row), role: 'main' }); authors.unshift(mapAuthor(row, 'main'))
    }
    const rawCategory = metadata.categoryId ? master.prepare('SELECT * FROM category WHERE category_id=?').get(Number(metadata.categoryId)) : null
    const category = mapCategory(rawCategory)
    if (metadata.categoryId && !category) throw new Error('converter_category_reference_missing')
    const rawPages = book.prepare('SELECT id,part,page,number,services FROM page ORDER BY id').all().map(plain)
    const pages = rawPages.map(mapPage)
    const titles = book.prepare('SELECT id,page,parent FROM title ORDER BY id').all().map(mapTitle)
    const duplicate = rows => rows.length !== new Set(rows.map(row => row.sourceRowId)).size
    if (duplicate(pages) || duplicate(titles)) throw new Error('converter_source_row_duplicate')
    const artifact = {
      schemaVersion: 1, contract: CONTRACT, workId: `shamela4_1:${expectedBookId}`, sourceBookId: expectedBookId,
      metadata, authors, category, pages, titles,
      sourceCapabilities: {
        pageBodyTextPresent: pages.some(page => page.services != null),
        titleTextPresent: false,
        note: 'The observed page/title SQLite schema contains page coordinates and hierarchy; no separate body/title text column was observed. Null source fields are preserved and no text is invented.',
      },
      provenance: {
        sourceId: 'shamela4_1-local-snapshot', mappingId: MAPPING_ID,
        inputs: [
          { role: 'master', logicalPath: masterSource.logicalPath, byteLength: masterSource.byteLength, sha256: masterSource.sha256, schemaFingerprint: masterObservation.schemaFingerprint },
          { role: 'book', logicalPath: bookSource.logicalPath, byteLength: bookSource.byteLength, sha256: bookSource.sha256, schemaFingerprint: bookObservation.schemaFingerprint },
        ],
      },
      counts: { metadataRows: 1, authors: authors.length, categoryRows: category ? 1 : 0, pages: pages.length, titles: titles.length },
    }
    const sourceText = textIntegrity(textCellsFromSource(plain(rawMetadata), rawAuthors, plain(rawCategory), rawPages))
    const roundTrip = JSON.parse(JSON.stringify(artifact)), roundTripText = textIntegrity(textCellsFromArtifact(roundTrip))
    if (JSON.stringify(sourceText) !== JSON.stringify(roundTripText)) throw new Error('converter_text_roundtrip_mismatch')
    const payloadSha256 = sha256(Buffer.from(JSON.stringify(artifact)))
    return { ...artifact, integrity: { sourceText, roundTripText, textPreserved: true, payloadSha256 } }
  } finally { master.close(); book.close() }
}

export async function writeArtifactAtomic(projectRoot, outputPath, artifact) {
  const root = resolve(projectRoot), target = within(root, resolve(root, outputPath)).path
  const pending = `${target}.${randomUUID()}.tmp`, bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`)
  try { await lstat(target); throw new Error('converter_output_exists') }
  catch (error) { if (!(error && typeof error === 'object' && error.code === 'ENOENT')) throw error }
  try { await writeFile(pending, bytes, { flag: 'wx' }); await rename(pending, target) }
  finally { await rm(pending, { force: true }) }
  return { logicalPath: relative(root, target).split(sep).join('/'), byteLength: bytes.byteLength, sha256: sha256(bytes) }
}

async function main(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1]
    if (!key?.startsWith('--') || value == null) throw new Error('converter_usage')
    options[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
  }
  for (const key of ['projectRoot','master','book','output']) if (!options[key]) throw new Error(`converter_option_required:${key}`)
  const artifact = await convertShamelaSqliteBook({ projectRoot: options.projectRoot, masterPath: options.master, bookPath: options.book, bookId: options.bookId })
  const output = await writeArtifactAtomic(options.projectRoot, options.output, artifact)
  process.stdout.write(`${JSON.stringify({ output, workId: artifact.workId, counts: artifact.counts, textIntegrity: artifact.integrity.sourceText, sourceCapabilities: artifact.sourceCapabilities })}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
