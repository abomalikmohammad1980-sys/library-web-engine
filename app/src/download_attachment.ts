export type DownloadAttachmentFormat = 'zip' | 'rar'
export const MAX_DOWNLOAD_ATTACHMENT_BYTES = 50 * 1024 * 1024

/** Download-only: inspect the container signature, never extract or index it. */
export function validateDownloadAttachment(name: string, bytes: Uint8Array): DownloadAttachmentFormat {
  if (!bytes.length || bytes.length > MAX_DOWNLOAD_ATTACHMENT_BYTES) throw Error('attachment_size')
  const extension = name.split('.').at(-1)?.toLowerCase()
  const starts = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte)
  const zip = starts([0x50, 0x4b, 3, 4]) || starts([0x50, 0x4b, 5, 6]) || starts([0x50, 0x4b, 7, 8])
  const rar = starts([0x52, 0x61, 0x72, 0x21, 0x1a, 7, 0]) || starts([0x52, 0x61, 0x72, 0x21, 0x1a, 7, 1, 0])
  if (extension === 'zip' && zip) return 'zip'
  if (extension === 'rar' && rar) return 'rar'
  throw Error('attachment_signature')
}

export function attachmentMimeType(format: DownloadAttachmentFormat): string {
  return format === 'zip' ? 'application/zip' : 'application/vnd.rar'
}

/** No path separators, bidirectional overrides or reserved Windows basenames. */
export function archiveEntryName(name: string): string {
  let safe = name.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069\\/:*?"<>|]/g, '-').trim().replace(/[. ]+$/g, '')
  if (!safe || safe === '.' || safe === '..') safe = 'file'
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = '_'+safe
  if (safe.length > 160) {
    const extension = /\.[a-z0-9]{1,10}$/i.exec(safe)?.[0] ?? ''
    safe = safe.slice(0,160-extension.length)+extension
  }
  return safe
}
