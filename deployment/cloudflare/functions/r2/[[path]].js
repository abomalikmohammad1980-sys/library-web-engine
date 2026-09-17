import { keyAfterPrefix, serveR2 } from "../_r2-read.js"

export function onRequest(context) {
  return serveR2(context, keyAfterPrefix(context.request, "/r2/"))
}
