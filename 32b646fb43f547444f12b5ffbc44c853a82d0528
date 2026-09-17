/** Simple bounded LRU cache keyed by string (Map order = insertion order). */
export class LruCache<K, V> {
  private readonly _map = new Map<K, V>();

  constructor(private readonly _max: number) {
    if (!Number.isInteger(_max) || _max < 1) throw new RangeError(`LRU max must be a positive integer: ${_max}`);
  }

  get size(): number {
    return this._map.size;
  }

  get(key: K): V | undefined {
    const v = this._map.get(key);
    if (v === undefined) return undefined;
    this._map.delete(key);
    this._map.set(key, v);
    return v;
  }

  set(key: K, value: V): void {
    if (this._map.has(key)) this._map.delete(key);
    this._map.set(key, value);
    while (this._map.size > this._max) {
      const oldest = this._map.keys().next().value;
      if (oldest === undefined) break;
      this._map.delete(oldest);
    }
  }

  clear(): void {
    this._map.clear();
  }
}
