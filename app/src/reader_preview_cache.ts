/** Bounded session cache for heavyweight cloned reader pages. */
export class ReaderPreviewCache<T> {
  private readonly values = new Map<string, T>()
  constructor(readonly limit = 8) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('invalid_reader_preview_cache_limit')
  }

  get(id: string): T | undefined {
    const value = this.values.get(id)
    if (value === undefined) return undefined
    this.values.delete(id)
    this.values.set(id, value)
    return value
  }

  set(id: string, value: T): void {
    this.values.delete(id)
    this.values.set(id, value)
    while (this.values.size > this.limit) {
      const oldest = this.values.keys().next().value
      if (oldest === undefined) break
      this.values.delete(oldest)
    }
  }

  delete(id: string): void { this.values.delete(id) }
  get size(): number { return this.values.size }
}
