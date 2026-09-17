import { keyAfterPrefix, serveR2 } from "../_r2-read.js"

export function onRequest(context) {
  // Only the public read gateway may use the preview's separate corpus binding.
  const env = context.env.PUBLIC_LIBRARY_R2
    ? { ...context.env, LIBRARY_R2: context.env.PUBLIC_LIBRARY_R2 }
    : context.env
  return serveR2({ ...context, env }, keyAfterPrefix(context.request, "/r2/"))
}
