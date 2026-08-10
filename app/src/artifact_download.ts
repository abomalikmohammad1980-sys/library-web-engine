import { createTrackedObjectURL, revokeTrackedObjectURL } from './resource_lifecycle'

export interface DownloadArtifactOptions {
  fileName: string
  mimeType: string
  content: BlobPart
}

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
    setTimeout(() => revokeTrackedObjectURL(url), 0)
  }
}
