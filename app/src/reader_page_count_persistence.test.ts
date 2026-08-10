import { describe, expect, it, vi } from 'vitest'
import { persistCompletedReaderPageCount } from './reader_page_count_persistence'
import { bookPageCount } from './book_page_count'

describe('completed reader page count persistence', () => {
  it('does not resolve completion before durable persistence finishes', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const persist = vi.fn(() => pending)
    let completed = false
    const task = persistCompletedReaderPageCount('book-1', 73, persist).then(() => { completed = true })
    await Promise.resolve()
    expect(persist).toHaveBeenCalledWith('book-1', 73)
    expect(completed).toBe(false)
    release()
    await task
    expect(completed).toBe(true)
  })

  it('does not write preview or non-library books', async () => {
    const persist = vi.fn(async () => undefined)
    await persistCompletedReaderPageCount('upload', 1, persist)
    await persistCompletedReaderPageCount('book-1', 0, persist)
    expect(persist).not.toHaveBeenCalled()
  })

  it('makes the completed count available to a reloaded book view', async () => {
    const stored: { readerPageCount?: number; wordPageMap: { totalPages: number } } = { wordPageMap: { totalPages: 72 } }
    await persistCompletedReaderPageCount('book-1', 73, async (_id, count) => { stored.readerPageCount = count })
    expect(bookPageCount({ ...stored })).toBe(73)
  })
})
