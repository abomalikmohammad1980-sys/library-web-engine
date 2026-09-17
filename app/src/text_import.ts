export const MAX_TEXT_BYTES = 20 * 1024 * 1024

export function decodeUtf8Text(data: Uint8Array, maxBytes = MAX_TEXT_BYTES): string {
  if (!data.length) throw new Error('الملف النصي فارغ')
  if (data.length > maxBytes) throw new Error(`حجم الملف النصي يتجاوز ${Math.floor(maxBytes / 1024 / 1024)} ميجابايت`)
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data) }
  catch { throw new Error('الملف ليس نص UTF-8 صالحًا') }
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!text.trim()) throw new Error('الملف النصي لا يحتوي محتوى مقروءًا')
  return text
}

/**
 * Published text books are verified and decoded once while they are materialized.
 * Reuse that verified text in the reader: decoding the original bytes again would
 * incorrectly re-apply the user-import 20MB ceiling to large local reference works.
 */
export function storedTextSource(data: Uint8Array, extractedText?: string): string {
  if (extractedText?.trim()) return extractedText
  return decodeUtf8Text(data)
}

export function textTitleFromFileName(fileName: string): string {
  return fileName.replace(/\.(txt|md)$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || 'كتاب نصي'
}

export function textParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map(value => value.replace(/\n/g, ' ').trim()).filter(Boolean)
}
