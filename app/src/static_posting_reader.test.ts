import { expect, it, vi } from 'vitest'
import { readStaticPosting } from './static_posting_reader'

it('returns only the requested word and accounts for actual bytes', async () => {
  const json = JSON.stringify({ entries: [['الف', [['1:0', [0], 100, 's1']]], ['باء', [['2:0', [4], 200, 's2']]]] })
  const value = await readStaticPosting(new Response(json), 'باء', 1024)
  expect(value.rows).toEqual([['2:0', [4], 200, 's2']])
  expect(value.bytes).toBe(new TextEncoder().encode(json).length)
})

it('rejects oversized and malformed buckets instead of returning empty results', async () => {
  await expect(readStaticPosting(new Response('12345'), 'الف', 4)).rejects.toThrow('too_large')
  await expect(readStaticPosting(new Response('<html>'), 'الف', 1024)).rejects.toThrow()
  await expect(readStaticPosting(Response.json({}), 'الف', 1024)).rejects.toThrow('invalid')
})

it('transfers bytes to a worker and terminates it after completion', async () => {
  const terminate = vi.fn(), post = vi.fn()
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void
    onerror?: () => void
    terminate = terminate
    postMessage(message: { bytes: ArrayBuffer; word: string }, transfer: ArrayBuffer[]) {
      post(message, transfer)
      this.onmessage?.({ data: { rows: [['1:0', [0], 100, 's1']] } })
    }
  }
  vi.stubGlobal('Worker', FakeWorker)
  try {
    const value = await readStaticPosting(new Response('{}'), 'الف', 100)
    expect(value.rows).toHaveLength(1)
    expect(post.mock.calls[0]?.[1][0]).toBe(post.mock.calls[0]?.[0].bytes)
    expect(terminate).toHaveBeenCalledOnce()
  } finally { vi.unstubAllGlobals() }
})

it('terminates a failed worker without treating failure as no matches', async () => {
  const terminate = vi.fn()
  class FakeWorker {
    onerror?: () => void
    terminate = terminate
    postMessage() { this.onerror?.() }
  }
  vi.stubGlobal('Worker', FakeWorker)
  try {
    await expect(readStaticPosting(new Response('{}'), 'الف', 100)).rejects.toThrow('worker_failed')
    expect(terminate).toHaveBeenCalledOnce()
  } finally { vi.unstubAllGlobals() }
})

it('terminates a silent worker at its deadline', async () => {
  vi.useFakeTimers()
  const terminate = vi.fn()
  class SilentWorker { terminate = terminate; postMessage() {} }
  vi.stubGlobal('Worker', SilentWorker)
  try {
    const task = readStaticPosting(new Response('{}'), 'الف', 100)
    const rejection = expect(task).rejects.toThrow('worker_timeout')
    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
    expect(terminate).toHaveBeenCalledOnce()
  } finally { vi.useRealTimers(); vi.unstubAllGlobals() }
})
