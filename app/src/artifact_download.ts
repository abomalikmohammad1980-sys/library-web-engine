import { createTrackedObjectURL, revokeTrackedObjectURL } from './resource_lifecycle'

export interface DownloadArtifactOptions {
  fileName: string
  mimeType: string
  content: BlobPart
}

const DOWNLOAD_URL_GRACE_MS = 30_000

export function downloadArtifact(options: DownloadArtifactOptions): void {
  const url = createTrackedObjectURL(new Blob([options.content], { type: options.mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = options.fileName
  link.hidden = true
  link.setAttribute('aria-hidden', 'true')
  document.body.appendChild(link)
  try { link.click() } finally {
    link.remove()
    // Mobile browsers can resolve the blob URL after the click task returns.
    // Revoking it immediately races the download hand-off, especially for
    // large collection archives. Retain it briefly, then release its memory.
    setTimeout(() => revokeTrackedObjectURL(url), DOWNLOAD_URL_GRACE_MS)
  }
}
