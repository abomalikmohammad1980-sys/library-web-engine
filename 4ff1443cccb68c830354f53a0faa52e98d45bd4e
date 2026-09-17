/** مخزّن الكتاب المرفوع — يمرّر الـ ArrayBuffer بين شاشة الرفع وقارئ upload. */

let _buffer: Uint8Array | null = null
let _name = ''

export function setUploadedBook(buf: Uint8Array, name: string): void {
  _buffer = buf
  _name = name
}

export function getUploadedBook(): { buf: Uint8Array; name: string } | null {
  const b = _buffer
  if (!b) return null
  _buffer = null // استهلاك لمرة واحدة
  const n = _name
  _name = ''
  return { buf: b, name: n }
}
