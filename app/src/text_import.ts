export const MAX_TEXT_BYTES = 20 * 1024 * 1024

export function decodeUtf8Text(data: Uint8Array): string {
  if (!data.length) throw new Error('الملف النصي فارغ')
  if (data.length > MAX_TEXT_BYTES) throw new Error('حجم الملف النصي يتجاوز 20 ميجابايت')
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data) }
  catch { throw new Error('الملف ليس نص UTF-8 صالحًا') }
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!text.trim()) throw new Error('الملف النصي لا يحتوي محتوى مقروءًا')
  return text
}

export function textTitleFromFileName(fileName: string): string {
  return fileName.replace(/\.(txt|md)$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || 'كتاب نصي'
}

export function textParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map(value => value.replace(/\n/g, ' ').trim()).filter(Boolean)
}
