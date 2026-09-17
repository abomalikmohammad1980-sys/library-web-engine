import { keyAfterPrefix, serveR2 } from "../_r2-read.js"

export function onRequest(context) {
  const suffix = keyAfterPrefix(context.request, "/library/")
  // This small descriptor is bound to the Pages release, not the R2 corpus.
  if (suffix === "shamela/sunnah-scope.json" && ["GET", "HEAD"].includes(context.request.method)) return context.next()
  return serveR2(context, `library/${suffix}`)
}
