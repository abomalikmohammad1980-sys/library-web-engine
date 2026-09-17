const READ_METHODS = new Set(["GET", "HEAD"])

function safeKey(value) {
  let decoded
  try { decoded = decodeURIComponent(value) } catch { return null }
  const key = decoded.replace(/^\/+/, "")
  if (!key || key.includes("%") || key.includes("\\") || key.split("/").some(part => !part || part === "." || part === "..")) return null
  return key
}

function responseHeaders(object, key) {
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("etag", object.httpEtag)
  headers.set("accept-ranges", "bytes")
  headers.set("x-content-type-options", "nosniff")
  headers.set("cross-origin-resource-policy", "same-origin")
  if (!headers.has("cache-control")) {
    headers.set("cache-control", /(?:manifest|catalog|current)\.json$/u.test(key)
      ? "public, max-age=300, must-revalidate"
      : "public, max-age=31536000, immutable")
  }
  return headers
}

export async function serveR2(context, rawKey) {
  if (!READ_METHODS.has(context.request.method)) {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } })
  }
  const key = safeKey(rawKey)
  // ملفات حسابات المستخدمين لا تمر عبر بوابة R2 العامة؛ تقرأ فقط من
  // /api/account/books/:id/file بعد التحقق الخادمي من المالك أو الإدارة.
  if (!key || key.startsWith("private/")) return new Response("Not Found", { status: 404 })

  if (context.request.method === "HEAD") {
    const object = await context.env.LIBRARY_R2.head(key)
    if (!object) return new Response("Not Found", { status: 404 })
    const headers = responseHeaders(object, key)
    headers.set("content-length", String(object.size))
    return new Response(null, { status: 200, headers })
  }

  const object = await context.env.LIBRARY_R2.get(key, {
    range: context.request.headers,
  })
  if (!object) return new Response("Not Found", { status: 404 })
  const headers = responseHeaders(object, key)
  if (!("body" in object)) return new Response(null, { status: 404, headers })

  let status = 200
  if (context.request.headers.has("range") && object.range) {
    const offset = object.range.offset ?? Math.max(0, object.size - object.range.length)
    const length = object.range.length ?? object.size - offset
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`)
    headers.set("content-length", String(length))
    status = 206
  } else {
    headers.set("content-length", String(object.size))
  }
  return new Response(object.body, { status, headers })
}

export function keyAfterPrefix(request, prefix) {
  const path = new URL(request.url).pathname
  return path.startsWith(prefix) ? path.slice(prefix.length) : ""
}
