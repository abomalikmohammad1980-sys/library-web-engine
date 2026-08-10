import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import {
  fetchVerifiedShamelaEntry, readShamelaZipDirectory, selectInitialShamelaDatabaseEntries,
  validateShamelaOfficialRelease, type ShamelaOfficialRelease, type ShamelaZipEntry,
} from '@library/source-sync'

export interface ShamelaAcquiredFile {
  path: string
  byteLength: number
  sha256: string
  zipCrc32: number
}

export interface ShamelaAcquisitionManifest {
  schemaVersion: 1
  source: Pick<ShamelaOfficialRelease, 'sourceId' | 'version' | 'archiveUrl' | 'contentLength' | 'etag' | 'lastModified'>
  selectedEntryCount: number
  completed: boolean
  files: ShamelaAcquiredFile[]
  fingerprint: string
  selection?: { kind: 'golden-sample'; bookCount: number; entries: string[] }
}

export interface ShamelaAcquireOptions {
  root: string
  release: ShamelaOfficialRelease
  fetcher?: typeof fetch
  maxEntries?: number
  goldenSample?: { bookCount: number }
  onProgress?: (completed: number, total: number, path: string) => void
}

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'ascii')
const MAX_GOLDEN_SAMPLE_BOOKS = 100

export async function acquireShamelaDatabases(options: ShamelaAcquireOptions): Promise<ShamelaAcquisitionManifest> {
  if (validateShamelaOfficialRelease(options.release).length) throw Error('shamela_release_unverified')
  const root = resolve(options.root)
  await mkdir(root, { recursive: true })
  await assertDirectory(root)
  const fetcher = options.fetcher ?? fetch
  const { entries } = await readShamelaZipDirectory(options.release, fetcher, 8 * 1024 * 1024)
  const eligible = selectInitialShamelaDatabaseEntries(entries).sort(compareEntries)
  const selection = goldenSampleSelection(eligible, options.goldenSample)
  const selected = selection ? eligible.filter(entry => selection.entries.includes(entry.path)) : eligible
  const maxEntries = options.maxEntries ?? 10_000
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || selected.length > maxEntries) throw Error('shamela_selected_entry_limit')
  const manifestPath = within(root, selection ? 'manifest.golden-sample.json' : 'manifest.json')
  let manifest = await loadManifest(manifestPath, options.release, selected.length, selection)
  const completed = new Map(manifest.files.map(file => [file.path, file]))
  for (const entry of selected) {
    const old = completed.get(entry.path)
    if (old && await verifyExisting(root, old)) {
      options.onProgress?.(completed.size, selected.length, entry.path)
      continue
    }
    const bytes = await fetchVerifiedShamelaEntry(entry, options.release, fetcher)
    if (bytes.byteLength < SQLITE_HEADER.length || !Buffer.from(bytes.subarray(0, SQLITE_HEADER.length)).equals(SQLITE_HEADER)) {
      throw Error('shamela_sqlite_signature_invalid')
    }
    const target = within(root, entry.path)
    await mkdir(dirname(target), { recursive: true })
    await writeAtomic(target, bytes)
    completed.set(entry.path, { path: entry.path, byteLength: bytes.byteLength, sha256: digest(bytes), zipCrc32: entry.crc32 })
    manifest = makeManifest(options.release, selected.length, [...completed.values()], completed.size === selected.length, selection)
    await writeManifestAtomic(manifestPath, manifest)
    options.onProgress?.(completed.size, selected.length, entry.path)
  }
  manifest = makeManifest(options.release, selected.length, [...completed.values()], true, selection)
  await writeManifestAtomic(manifestPath, manifest)
  return manifest
}

function makeManifest(release: ShamelaOfficialRelease, selectedEntryCount: number, files: ShamelaAcquiredFile[], completed: boolean, selection?: ShamelaAcquisitionManifest['selection']): ShamelaAcquisitionManifest {
  const sorted = files.sort((a, b) => a.path.localeCompare(b.path))
  const source = { sourceId: release.sourceId, version: release.version, archiveUrl: release.archiveUrl, contentLength: release.contentLength, etag: release.etag, lastModified: release.lastModified }
  const fingerprint = digest(Buffer.from(JSON.stringify({ source, selectedEntryCount, completed, files: sorted, selection })))
  return { schemaVersion: 1, source, selectedEntryCount, completed, files: sorted, fingerprint, ...(selection ? { selection } : {}) }
}

async function loadManifest(path: string, release: ShamelaOfficialRelease, selectedEntryCount: number, selection?: ShamelaAcquisitionManifest['selection']): Promise<ShamelaAcquisitionManifest> {
  let sawInvalid = false
  for (const candidate of [path, `${path}.previous`]) {
    try {
      const value = JSON.parse(await readFile(candidate, 'utf8')) as ShamelaAcquisitionManifest
      const expected = makeManifest(release, value.selectedEntryCount, value.files, value.completed, selection)
      if (value.schemaVersion !== 1 || value.selectedEntryCount !== selectedEntryCount || value.fingerprint !== expected.fingerprint
        || JSON.stringify(value.source) !== JSON.stringify(expected.source)
        || JSON.stringify(value.selection) !== JSON.stringify(selection)) { sawInvalid = true; continue }
      return value
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') sawInvalid = true
    }
  }
  if (sawInvalid) throw Error('shamela_manifest_mismatch')
  return makeManifest(release, selectedEntryCount, [], false, selection)
}

function goldenSampleSelection(entries: readonly ShamelaZipEntry[], sample: ShamelaAcquireOptions['goldenSample']): ShamelaAcquisitionManifest['selection'] | undefined {
  if (!sample) return undefined
  if (!Number.isSafeInteger(sample.bookCount) || sample.bookCount < 1 || sample.bookCount > MAX_GOLDEN_SAMPLE_BOOKS) throw Error('shamela_golden_sample_book_limit')
  const books = entries.filter(entry => /^database\/book\//i.test(entry.path)).slice(0, sample.bookCount)
  if (!books.length) throw Error('shamela_golden_sample_books_missing')
  const services = entries.filter(entry => !/^database\/book\//i.test(entry.path))
  return { kind: 'golden-sample', bookCount: sample.bookCount, entries: [...books, ...services].sort(compareEntries).map(entry => entry.path) }
}

function compareEntries(a: ShamelaZipEntry, b: ShamelaZipEntry): number { return comparePaths(a.path, b.path) }
function comparePaths(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0 }

async function verifyExisting(root: string, file: ShamelaAcquiredFile): Promise<boolean> {
  try {
    const path = within(root, file.path)
    const item = await lstat(path)
    if (!item.isFile() || item.isSymbolicLink() || item.size !== file.byteLength) return false
    return digest(await readFile(path)) === file.sha256
  } catch { return false }
}

async function writeAtomic(path: string, bytes: Uint8Array): Promise<void> {
  const pending = `${path}.${randomUUID()}.tmp`
  const previous = `${path}.previous`
  try {
    await writeFile(pending, bytes, { flag: 'wx' })
    await rm(previous, { force: true })
    await rename(path, previous).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error })
    await rename(pending, path)
    await rm(previous, { force: true })
  } catch (error) {
    try { await lstat(path) } catch { await rename(previous, path).catch(() => undefined) }
    throw error
  } finally { await rm(pending, { force: true }) }
}

async function writeManifestAtomic(path: string, manifest: ShamelaAcquisitionManifest): Promise<void> {
  const pending = `${path}.${randomUUID()}.tmp`
  const previous = `${path}.previous`
  try {
    await writeFile(pending, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
    await rm(previous, { force: true })
    await rename(path, previous).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error })
    await rename(pending, path)
    await rm(previous, { force: true })
  } catch (error) {
    try { await lstat(path) } catch { await rename(previous, path).catch(() => undefined) }
    throw error
  } finally { await rm(pending, { force: true }) }
}

function within(root: string, logical: string): string {
  const path = resolve(root, logical)
  const rel = relative(root, path)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== path) throw Error('shamela_output_path_escape')
  return path
}
function digest(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex') }
async function assertDirectory(path: string): Promise<void> { const item = await lstat(path); if (!item.isDirectory() || item.isSymbolicLink()) throw Error('shamela_output_root_unsafe') }
