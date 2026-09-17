import { keyAfterPrefix, serveR2 } from "../_r2-read.js"

export function onRequest(context) {
  const suffix = keyAfterPrefix(context.request, "/library/")
  // This small descriptor is bound to the Pages release, not the R2 corpus.
  if (suffix === "shamela/sunnah-scope.json" && ["GET", "HEAD"].includes(context.request.method)) return context.next()
  // Preview may read the public corpus while uploads stay in its isolated bucket.
  // This override is confined to this GET/HEAD gateway; never mutate env bindings.
  const env = context.env.PUBLIC_LIBRARY_R2
    ? { ...context.env, LIBRARY_R2: context.env.PUBLIC_LIBRARY_R2 }
    : context.env
  return serveR2({ ...context, env }, `library/${suffix}`)
}
