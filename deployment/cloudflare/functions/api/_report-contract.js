const encoder = new TextEncoder()

export const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'same-origin',
  },
})

export function sameOrigin(request) {
  if ((request.headers.get('sec-fetch-site') || '').toLowerCase() === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).origin === new URL(request.url).origin } catch { return false }
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function bearer(request) {
  const value = request.headers.get('authorization') || ''
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

export function safeReport(input) {
  if (!input || typeof input !== 'object') return null
  const fields = ['bookTitle', 'bookId', 'errorCode', 'route', 'appVersion', 'deviceClass', 'userAgent', 'timestamp', 'retryState']
  const limits = [240, 160, 80, 500, 80, 16, 500, 40, 20]
  const result = {}
  for (let index = 0; index < fields.length; index += 1) {
    const value = input[fields[index]]
    if (typeof value !== 'string') return null
    result[fields[index]] = value.replace(/[\u0000-\u001f\u007f]+/gu, ' ').replace(/\s{2,}/gu, ' ').trim().slice(0, limits[index])
    if (!result[fields[index]]) return null
  }
  return result
}
