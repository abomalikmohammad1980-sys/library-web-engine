// Alibaba Machine Translation ROA signing uses Content-MD5; Web Crypto deliberately
// does not expose MD5, so this isolated implementation is used only for that header.
export function contentMd5(body) {
  const bytes = new TextEncoder().encode(body)
  const length = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(length)
  padded.set(bytes); padded[bytes.length] = 0x80
  const words = new DataView(padded.buffer)
  words.setUint32(length - 8, bytes.length * 8 >>> 0, true)
  words.setUint32(length - 4, Math.floor(bytes.length * 8 / 2 ** 32), true)
  const shifts = [7,12,17,22, 5,9,14,20, 4,11,16,23, 6,10,15,21]
  const constants = Array.from({length: 64}, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0)
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
  for (let offset = 0; offset < length; offset += 64) {
    let a = a0, b = b0, c = c0, d = d0
    for (let i = 0; i < 64; i++) {
      let f, g, shift
      if (i < 16) { f = (b & c) | (~b & d); g = i; shift = shifts[i % 4] }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; shift = shifts[4 + i % 4] }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; shift = shifts[8 + i % 4] }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; shift = shifts[12 + i % 4] }
      const n = (a + f + constants[i] + words.getUint32(offset + 4 * g, true)) >>> 0
      const rotated = (n << shift) | (n >>> (32 - shift))
      ;[a, b, c, d] = [d, (b + rotated) >>> 0, b, c]
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0
  }
  const digest = new DataView(new ArrayBuffer(16))
  ;[a0, b0, c0, d0].forEach((value, i) => digest.setUint32(i * 4, value, true))
  return btoa(String.fromCharCode(...new Uint8Array(digest.buffer)))
}

export async function translateAlibaba({ env, text, target }) {
  const path = '/api/translate/web/general', host = 'mt.cn-hangzhou.aliyuncs.com'
  const body = JSON.stringify({ FormatType: 'text', SourceLanguage: 'ar', TargetLanguage: target, SourceText: text, Scene: 'general' })
  const date = new Date().toUTCString(), nonce = crypto.randomUUID()
  const md5 = contentMd5(body), type = 'application/json;charset=utf-8'
  const stringToSign = `POST\napplication/json\n${md5}\n${type}\n${date}\nx-acs-signature-method:HMAC-SHA1\nx-acs-signature-nonce:${nonce}\nx-acs-version:2019-01-02\n${path}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.ALIBABA_TRANSLATE_ACCESS_KEY_SECRET), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign))
  const signature = btoa(String.fromCharCode(...new Uint8Array(signed)))
  const response = await fetch(`https://${host}${path}`, { method: 'POST', signal: AbortSignal.timeout(10000), headers: {
    accept: 'application/json', 'content-type': type, 'content-md5': md5, date,
    'x-acs-signature-method': 'HMAC-SHA1', 'x-acs-signature-nonce': nonce, 'x-acs-version': '2019-01-02',
    authorization: `acs ${env.ALIBABA_TRANSLATE_ACCESS_KEY_ID}:${signature}`,
  }, body })
  if (!response.ok) throw new Error(`provider_http_${response.status}`)
  const payload = await response.json()
  const result = payload.TranslateGeneralResponse || payload
  if (Number(result.Code) !== 200 || !result.Data?.Translated) throw new Error('provider_invalid_response')
  return result.Data.Translated
}
