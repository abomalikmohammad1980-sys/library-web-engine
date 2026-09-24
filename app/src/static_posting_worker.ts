import { extractStaticPosting } from './static_posting_extract'

self.onmessage = (event: MessageEvent<{ bytes: ArrayBuffer; word: string }>) => {
  try {
    self.postMessage({ rows: extractStaticPosting(event.data.bytes, event.data.word) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
