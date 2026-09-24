import { extractStaticPosting, type StaticPosting } from './static_posting_extract'

/** Parsing a multi-megabyte JSON bucket must not block the reader/search UI. */
export async function readStaticPosting(response: Response, word: string, maxBytes: number): Promise<{ rows: StaticPosting[]; bytes: number }> {
  if (!response.ok) throw Error(`shamela_static_posting_http_${response.status}`)
  const declared = Number(response.headers.get('content-length'))
  if (declared > maxBytes) throw Error('shamela_static_posting_too_large')
  const bytes = await response.arrayBuffer()
  const size = bytes.byteLength
  if (size > maxBytes) throw Error('shamela_static_posting_too_large')
  if (typeof Worker === 'undefined') return { rows: extractStaticPosting(bytes, word), bytes: size }
  const worker = new Worker(new URL('./static_posting_worker.ts', import.meta.url), { type: 'module' })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const rows = await new Promise<StaticPosting[]>((resolve, reject) => {
      timer = setTimeout(() => reject(Error('shamela_static_posting_worker_timeout')), 15_000)
      worker.onmessage = (event: MessageEvent<{ rows?: StaticPosting[]; error?: string }>) => {
        if (event.data.error || !Array.isArray(event.data.rows)) reject(Error(event.data.error ?? 'shamela_static_posting_invalid'))
        else resolve(event.data.rows)
      }
      worker.onerror = () => reject(Error('shamela_static_posting_worker_failed'))
      worker.postMessage({ bytes, word }, [bytes])
    })
    return { rows, bytes: size }
  } finally {
    clearTimeout(timer)
    worker.terminate()
  }
}
