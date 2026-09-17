import { inflateSync } from 'fflate'
import { fetchVerifiedShamelaRange, type ShamelaOfficialRelease } from './shamela-official-release.js'

const EOCD = 0x06054b50
const ZIP64_EOCD = 0x06064b50
const ZIP64_LOCATOR = 0x07064b50
const CENTRAL_ENTRY = 0x02014b50
const LOCAL_ENTRY = 0x04034b50
const MAX_CENTRAL_DIRECTORY_BYTES = 64 * 1024 * 1024

export interface ShamelaZipDirectory {
  entryCount: number
  centralDirectoryOffset: number
  centralDirectorySize: number
  zip64: boolean
}

export interface ShamelaZipEntry {
  path: string
  compressionMethod: number
  flags: number
  crc32: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

function u16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true)
}
function u32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true)
}
function u64(bytes: Uint8Array, offset: number): number {
  const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset, true)
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('shamela_zip64_value_unsafe')
  return Number(value)
}
function findSignatureBackwards(bytes: Uint8Array, signature: number, before = bytes.length): number {
  for (let offset = Math.min(before - 4, bytes.length - 4); offset >= 0; offset--) {
    if (u32(bytes, offset) === signature) return offset
  }
  return -1
}
function safeZipPath(path: string): boolean {
  if (!path || path.includes('\\') || path.startsWith('/') || /^[a-z]:/i.test(path)) return false
  const normalized = path.endsWith('/') ? path.slice(0, -1) : path
  if (!normalized) return false
  const segments = normalized.split('/')
  return segments.every(segment => segment && segment !== '.' && segment !== '..')
}

export function isInitialShamelaDatabaseEntry(path: string): boolean {
  if (!safeZipPath(path)) return false
  return /^database\/book\/(?:[^/]+\/)?[^/]+\.db$/i.test(path)
    || /^database\/(?:master|service|services)\.db$/i.test(path)
    || /^database\/(?:service|services)\/[^/]+\.db$/i.test(path)
}

export function selectInitialShamelaDatabaseEntries(entries: readonly ShamelaZipEntry[]): ShamelaZipEntry[] {
  return entries.filter(entry => isInitialShamelaDatabaseEntry(entry.path))
}

export function parseShamelaCentralDirectory(bytes: Uint8Array, expectedEntries?: number): ShamelaZipEntry[] {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const entries: ShamelaZipEntry[] = []
  let parsedEntries = 0
  let offset = 0
  while (offset < bytes.length) {
    if (offset + 46 > bytes.length || u32(bytes, offset) !== CENTRAL_ENTRY) throw new Error('shamela_central_directory_invalid')
    const flags = u16(bytes, offset + 8)
    const compressionMethod = u16(bytes, offset + 10)
    const crc32 = u32(bytes, offset + 16)
    let compressedSize = u32(bytes, offset + 20)
    let uncompressedSize = u32(bytes, offset + 24)
    const nameLength = u16(bytes, offset + 28)
    const extraLength = u16(bytes, offset + 30)
    const commentLength = u16(bytes, offset + 32)
    let localHeaderOffset = u32(bytes, offset + 42)
    const end = offset + 46 + nameLength + extraLength + commentLength
    if (end > bytes.length) throw new Error('shamela_central_entry_truncated')
    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (!safeZipPath(path)) throw new Error('shamela_zip_path_unsafe')
    parsedEntries++
    if (path.endsWith('/')) {
      offset = end
      continue
    }
    const extra = bytes.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength)
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      let extraOffset = 0
      let zip64: Uint8Array | null = null
      while (extraOffset + 4 <= extra.length) {
        const id = u16(extra, extraOffset)
        const size = u16(extra, extraOffset + 2)
        if (extraOffset + 4 + size > extra.length) throw new Error('shamela_zip_extra_invalid')
        if (id === 0x0001) zip64 = extra.subarray(extraOffset + 4, extraOffset + 4 + size)
        extraOffset += 4 + size
      }
      if (!zip64) throw new Error('shamela_zip64_extra_missing')
      let z = 0
      if (uncompressedSize === 0xffffffff) { uncompressedSize = u64(zip64, z); z += 8 }
      if (compressedSize === 0xffffffff) { compressedSize = u64(zip64, z); z += 8 }
      if (localHeaderOffset === 0xffffffff) localHeaderOffset = u64(zip64, z)
    }
    entries.push({ path, compressionMethod, flags, crc32, compressedSize, uncompressedSize, localHeaderOffset })
    offset = end
  }
  if (expectedEntries !== undefined && parsedEntries !== expectedEntries) throw new Error('shamela_entry_count_mismatch')
  return entries
}

export async function readShamelaZipDirectory(
  release: ShamelaOfficialRelease,
  fetcher: typeof fetch = fetch,
  tailBytes = 2 * 1024 * 1024,
): Promise<{ directory: ShamelaZipDirectory; entries: ShamelaZipEntry[] }> {
  const tailStart = Math.max(0, release.contentLength - tailBytes)
  const tail = await fetchVerifiedShamelaRange({ start: tailStart, end: release.contentLength - 1 }, release, fetcher)
  const eocdOffset = findSignatureBackwards(tail, EOCD)
  if (eocdOffset < 0 || eocdOffset + 22 > tail.length) throw new Error('shamela_eocd_missing')
  const disk = u16(tail, eocdOffset + 4)
  const centralDisk = u16(tail, eocdOffset + 6)
  if (disk !== 0 || centralDisk !== 0) throw new Error('shamela_multidisk_zip_unsupported')
  let entryCount = u16(tail, eocdOffset + 10)
  let centralDirectorySize = u32(tail, eocdOffset + 12)
  let centralDirectoryOffset = u32(tail, eocdOffset + 16)
  let zip64 = false
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    zip64 = true
    const locatorOffset = findSignatureBackwards(tail, ZIP64_LOCATOR, eocdOffset)
    if (locatorOffset < 0 || locatorOffset + 20 > tail.length) throw new Error('shamela_zip64_locator_missing')
    const recordOffset = u64(tail, locatorOffset + 8)
    const record = await fetchVerifiedShamelaRange({ start: recordOffset, end: recordOffset + 55 }, release, fetcher)
    if (u32(record, 0) !== ZIP64_EOCD || u32(record, 16) !== 0 || u32(record, 20) !== 0) throw new Error('shamela_zip64_eocd_invalid')
    entryCount = u64(record, 32)
    centralDirectorySize = u64(record, 40)
    centralDirectoryOffset = u64(record, 48)
  }
  if (centralDirectorySize < 1 || centralDirectorySize > MAX_CENTRAL_DIRECTORY_BYTES
    || centralDirectoryOffset + centralDirectorySize > release.contentLength) throw new Error('shamela_central_directory_bounds_invalid')
  const central = await fetchVerifiedShamelaRange({
    start: centralDirectoryOffset, end: centralDirectoryOffset + centralDirectorySize - 1,
  }, release, fetcher)
  return {
    directory: { entryCount, centralDirectoryOffset, centralDirectorySize, zip64 },
    entries: parseShamelaCentralDirectory(central, entryCount),
  }
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export async function fetchVerifiedShamelaEntry(
  entry: ShamelaZipEntry,
  release: ShamelaOfficialRelease,
  fetcher: typeof fetch = fetch,
): Promise<Uint8Array> {
  if (!isInitialShamelaDatabaseEntry(entry.path)) throw new Error('shamela_entry_not_allowed')
  if (entry.flags & 0x1) throw new Error('shamela_entry_encrypted')
  if (![0, 8].includes(entry.compressionMethod)) throw new Error('shamela_compression_unsupported')
  if (entry.compressedSize > 64 * 1024 * 1024 || entry.uncompressedSize > 256 * 1024 * 1024) throw new Error('shamela_entry_too_large')
  if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > 200) throw new Error('shamela_entry_ratio_exceeded')
  const fixed = await fetchVerifiedShamelaRange({ start: entry.localHeaderOffset, end: entry.localHeaderOffset + 29 }, release, fetcher)
  if (u32(fixed, 0) !== LOCAL_ENTRY) throw new Error('shamela_local_header_invalid')
  const nameLength = u16(fixed, 26)
  const extraLength = u16(fixed, 28)
  const variable = nameLength + extraLength
    ? await fetchVerifiedShamelaRange({ start: entry.localHeaderOffset + 30, end: entry.localHeaderOffset + 29 + nameLength + extraLength }, release, fetcher)
    : new Uint8Array()
  const localPath = new TextDecoder('utf-8', { fatal: true }).decode(variable.subarray(0, nameLength))
  if (localPath !== entry.path) throw new Error('shamela_local_path_mismatch')
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength
  const compressed = entry.compressedSize
    ? await fetchVerifiedShamelaRange({ start: dataStart, end: dataStart + entry.compressedSize - 1 }, release, fetcher)
    : new Uint8Array()
  const output = entry.compressionMethod === 0 ? compressed : inflateSync(compressed)
  if (output.byteLength !== entry.uncompressedSize) throw new Error('shamela_entry_size_mismatch')
  if (crc32(output) !== entry.crc32) throw new Error('shamela_entry_crc_mismatch')
  return output
}
