export interface ShamelaOfficialRelease {
  sourceId: 'shamela-official-database'
  version: string
  archiveUrl: string
  contentLength: number
  etag: string
  lastModified: string
  acceptsByteRanges: true
  observedAt: string
}

export interface ShamelaDownloadCheckpoint {
  sourceId: ShamelaOfficialRelease['sourceId']
  version: string
  archiveUrl: string
  contentLength: number
  etag: string
  lastModified: string
  nextByte: number
}

export interface ShamelaByteRange { start: number; end: number }

export interface ShamelaAcquisitionPlan {
  strategy: 'full-archive' | 'pack-on-demand'
  archiveAccess: 'full-stream' | 'sparse-zip-range'
  downloadFullArchive: boolean
  availableBytes: number
  archiveBytes: number
  safetyReserveBytes: number
  reason: 'capacity-sufficient' | 'insufficient-capacity'
}

export const SHAMELA_OFFICIAL_1448_2: ShamelaOfficialRelease = {
  sourceId: 'shamela-official-database',
  version: '1448.2',
  archiveUrl: 'https://dev.shamela.ws/downloads/shamela-database-1448.2.zip',
  contentLength: 13_294_044_352,
  etag: '"3186304c0-657d8c744ef00"',
  lastModified: 'Thu, 30 Jul 2026 19:07:08 GMT',
  acceptsByteRanges: true,
  observedAt: '2026-08-10T13:47:12Z',
}

function isHttps(value: string): boolean {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

export function validateShamelaOfficialRelease(release: ShamelaOfficialRelease): string[] {
  const errors: string[] = []
  if (release.sourceId !== 'shamela-official-database') errors.push('shamela_source_id_invalid')
  if (!/^\d{4}\.\d+$/.test(release.version)) errors.push('shamela_version_invalid')
  if (!isHttps(release.archiveUrl) || new URL(release.archiveUrl).hostname !== 'dev.shamela.ws') errors.push('shamela_url_invalid')
  if (!Number.isSafeInteger(release.contentLength) || release.contentLength < 1) errors.push('shamela_size_invalid')
  if (!/^"[0-9a-f]+-[0-9a-f]+"$/i.test(release.etag)) errors.push('shamela_etag_invalid')
  if (!Number.isFinite(Date.parse(release.lastModified))) errors.push('shamela_last_modified_invalid')
  if (!Number.isFinite(Date.parse(release.observedAt))) errors.push('shamela_observed_at_invalid')
  if (release.acceptsByteRanges !== true) errors.push('shamela_ranges_required')
  return errors
}

export function planShamelaAcquisition(
  availableBytes: number,
  release: ShamelaOfficialRelease = SHAMELA_OFFICIAL_1448_2,
  safetyReserveBytes = 1_073_741_824,
): ShamelaAcquisitionPlan {
  if (validateShamelaOfficialRelease(release).length) throw new Error('shamela_release_unverified')
  if (!Number.isSafeInteger(availableBytes) || availableBytes < 0) throw new Error('shamela_capacity_invalid')
  if (!Number.isSafeInteger(safetyReserveBytes) || safetyReserveBytes < 0) throw new Error('shamela_reserve_invalid')
  const enough = availableBytes >= release.contentLength + safetyReserveBytes
  return {
    strategy: enough ? 'full-archive' : 'pack-on-demand',
    archiveAccess: enough ? 'full-stream' : 'sparse-zip-range',
    downloadFullArchive: enough,
    availableBytes,
    archiveBytes: release.contentLength,
    safetyReserveBytes,
    reason: enough ? 'capacity-sufficient' : 'insufficient-capacity',
  }
}

export function createShamelaCheckpoint(
  release: ShamelaOfficialRelease = SHAMELA_OFFICIAL_1448_2,
): ShamelaDownloadCheckpoint {
  if (validateShamelaOfficialRelease(release).length) throw new Error('shamela_release_unverified')
  return { ...release, nextByte: 0 }
}

export function validateShamelaCheckpoint(
  checkpoint: ShamelaDownloadCheckpoint,
  release: ShamelaOfficialRelease = SHAMELA_OFFICIAL_1448_2,
): string[] {
  const errors: string[] = []
  if (validateShamelaOfficialRelease(release).length) errors.push('shamela_release_unverified')
  if (checkpoint.sourceId !== release.sourceId || checkpoint.version !== release.version
    || checkpoint.archiveUrl !== release.archiveUrl || checkpoint.contentLength !== release.contentLength
    || checkpoint.etag !== release.etag || checkpoint.lastModified !== release.lastModified) {
    errors.push('shamela_checkpoint_release_mismatch')
  }
  if (!Number.isSafeInteger(checkpoint.nextByte) || checkpoint.nextByte < 0 || checkpoint.nextByte > release.contentLength) {
    errors.push('shamela_checkpoint_offset_invalid')
  }
  return errors
}

export function nextShamelaRange(
  checkpoint: ShamelaDownloadCheckpoint,
  maxChunkBytes = 8 * 1024 * 1024,
  release: ShamelaOfficialRelease = SHAMELA_OFFICIAL_1448_2,
): ShamelaByteRange | null {
  if (validateShamelaCheckpoint(checkpoint, release).length) throw new Error('shamela_checkpoint_invalid')
  if (!Number.isSafeInteger(maxChunkBytes) || maxChunkBytes < 1) throw new Error('shamela_chunk_size_invalid')
  if (checkpoint.nextByte === release.contentLength) return null
  return { start: checkpoint.nextByte, end: Math.min(release.contentLength - 1, checkpoint.nextByte + maxChunkBytes - 1) }
}

function expectedContentRange(range: ShamelaByteRange, total: number): string {
  return `bytes ${range.start}-${range.end}/${total}`
}

export async function fetchVerifiedShamelaRange(
  range: ShamelaByteRange,
  release: ShamelaOfficialRelease = SHAMELA_OFFICIAL_1448_2,
  fetcher: typeof fetch = fetch,
): Promise<Uint8Array> {
  if (validateShamelaOfficialRelease(release).length) throw new Error('shamela_release_unverified')
  if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end)
    || range.start < 0 || range.end < range.start || range.end >= release.contentLength) throw new Error('shamela_range_invalid')
  const response = await fetcher(release.archiveUrl, {
    headers: { Range: `bytes=${range.start}-${range.end}`, 'If-Range': release.lastModified },
    cache: 'no-store',
  })
  if (response.status !== 206) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error('shamela_range_not_honored')
  }
  if (response.headers.get('content-range') !== expectedContentRange(range, release.contentLength)) throw new Error('shamela_content_range_mismatch')
  if (response.headers.get('etag') !== release.etag) throw new Error('shamela_etag_mismatch')
  if (response.headers.get('last-modified') !== release.lastModified) throw new Error('shamela_last_modified_mismatch')
  if (response.headers.get('accept-ranges')?.toLowerCase() !== 'bytes') throw new Error('shamela_ranges_not_confirmed')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== range.end - range.start + 1) throw new Error('shamela_chunk_length_mismatch')
  return bytes
}

export function commitShamelaRange(
  checkpoint: ShamelaDownloadCheckpoint,
  range: ShamelaByteRange,
  bytes: Uint8Array,
  release: ShamelaOfficialRelease = SHAMELA_OFFICIAL_1448_2,
): ShamelaDownloadCheckpoint {
  if (validateShamelaCheckpoint(checkpoint, release).length) throw new Error('shamela_checkpoint_invalid')
  if (range.start !== checkpoint.nextByte || bytes.byteLength !== range.end - range.start + 1) throw new Error('shamela_chunk_commit_invalid')
  return { ...checkpoint, nextByte: range.end + 1 }
}
