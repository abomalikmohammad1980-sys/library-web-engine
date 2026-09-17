export interface AuthorPortraitUpload { data: Uint8Array; mimeType: string }
export const MAX_AUTHOR_PORTRAIT_BYTES = 5 * 1024 * 1024
const AUTHOR_PORTRAIT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export function validateAuthorPortrait(file: Pick<File, 'type' | 'size'>): string | undefined {
  if (!AUTHOR_PORTRAIT_TYPES.has(file.type)) return 'صيغة الصورة غير مدعومة؛ استخدم PNG أو JPEG أو WebP.'
  if (file.size <= 0) return 'ملف الصورة فارغ.'
  if (file.size > MAX_AUTHOR_PORTRAIT_BYTES) return 'حجم الصورة أكبر من 5 MB.'
  return undefined
}

export function authorPortraitUpdate(remove: boolean, upload?: AuthorPortraitUpload): { imageData?: Uint8Array | null; imageMimeType?: string | null } {
  if (upload) return { imageData: upload.data, imageMimeType: upload.mimeType }
  return remove ? { imageData: null, imageMimeType: null } : {}
}
