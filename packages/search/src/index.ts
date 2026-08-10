export interface SearchDocument {
  id: string
  bookId: string
  paragraphIndex: number
  text: string
}

export interface SearchHit {
  id: string
  bookId: string
  paragraphIndex: number
  text: string
  matchOffset: number
}

export interface SearchPage {
  total: number
  offset: number
  limit: number
  hits: SearchHit[]
}

export interface SerializedSearchShard {
  version: 1
  id: string
  documents: SearchDocument[]
  folded: string[]
  postings: Array<[string, number[]]>
}

export class ArabicSearchShard {
  readonly id: string
  private readonly documents: SearchDocument[]
  private readonly folded: string[]
  private readonly postings: Map<string, number[]>

  private constructor(id: string, documents: SearchDocument[], folded: string[], postings: Map<string, number[]>) {
    this.id = id
    this.documents = documents
    this.folded = folded
    this.postings = postings
  }

  static build(id: string, documents: readonly SearchDocument[]): ArabicSearchShard {
    const owned = documents.map(document => ({ ...document }))
    const folded = owned.map(document => normalizeArabicSearch(document.text))
    const postings = new Map<string, number[]>()
    folded.forEach((text, ordinal) => {
      for (const gram of uniqueQueryGrams(text)) {
        const list = postings.get(gram)
        if (list) list.push(ordinal)
        else postings.set(gram, [ordinal])
      }
    })
    return new ArabicSearchShard(id, owned, folded, postings)
  }

  static restore(value: SerializedSearchShard): ArabicSearchShard {
    if (value.version !== 1) throw new Error(`Unsupported search shard version: ${String(value.version)}`)
    return new ArabicSearchShard(value.id, value.documents, value.folded, new Map(value.postings))
  }

  serialize(): SerializedSearchShard {
    return { version: 1, id: this.id, documents: this.documents, folded: this.folded, postings: [...this.postings] }
  }

  search(query: string, offset = 0, limit = 40): SearchPage {
    const wanted = normalizeArabicSearch(query).trim()
    const safeOffset = Math.max(0, Math.trunc(offset))
    const safeLimit = Math.max(0, Math.min(500, Math.trunc(limit)))
    if (wanted.length < 2 || safeLimit === 0) return { total: 0, offset: safeOffset, limit: safeLimit, hits: [] }
    const grams = uniqueQueryGrams(wanted)
    const candidates = grams.length
      ? intersectPostingLists(grams.map(gram => this.postings.get(gram) ?? []))
      : this.documents.map((_, ordinal) => ordinal)
    let total = 0
    const hits: SearchHit[] = []
    for (const ordinal of candidates) {
      const matchOffset = this.folded[ordinal]?.indexOf(wanted) ?? -1
      if (matchOffset < 0) continue
      if (total >= safeOffset && hits.length < safeLimit) {
        const document = this.documents[ordinal]!
        hits.push({ ...document, matchOffset })
      }
      total += 1
    }
    return { total, offset: safeOffset, limit: safeLimit, hits }
  }
}

export function normalizeArabicSearch(value: string): string {
  return value.toLocaleLowerCase('ar')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/gu, ' ')
}

function uniqueQueryGrams(value: string): string[] {
  if (value.length < 3) return []
  const grams = new Set<string>()
  for (let index = 0; index <= value.length - 3; index += 1) grams.add(value.slice(index, index + 3))
  return [...grams]
}

function intersectPostingLists(lists: number[][]): number[] {
  if (!lists.length || lists.some(list => list.length === 0)) return []
  const ordered = [...lists].sort((a, b) => a.length - b.length)
  let candidates = ordered[0]!
  for (let index = 1; index < ordered.length && candidates.length; index += 1) {
    const next = ordered[index]!
    const intersection: number[] = []
    let left = 0
    let right = 0
    while (left < candidates.length && right < next.length) {
      const a = candidates[left]!
      const b = next[right]!
      if (a === b) { intersection.push(a); left += 1; right += 1 }
      else if (a < b) left += 1
      else right += 1
    }
    candidates = intersection
  }
  return candidates
}

export type SearchWorkerRequest =
  | { requestId: string; type: 'build'; shardId: string; documents: SearchDocument[] }
  | { requestId: string; type: 'restore'; shard: SerializedSearchShard }
  | { requestId: string; type: 'search'; shardId: string; query: string; offset?: number; limit?: number }
  | { requestId: string; type: 'serialize'; shardId: string }
  | { requestId: string; type: 'drop'; shardId: string }

export type SearchWorkerResponse =
  | { requestId: string; ok: true; value: { shardId: string } | SearchPage | SerializedSearchShard | null }
  | { requestId: string; ok: false; error: string }

export function createSearchWorkerHandler() {
  const shards = new Map<string, ArabicSearchShard>()
  return (request: SearchWorkerRequest): SearchWorkerResponse => {
    try {
      if (request.type === 'build') {
        shards.set(request.shardId, ArabicSearchShard.build(request.shardId, request.documents))
        return { requestId: request.requestId, ok: true, value: { shardId: request.shardId } }
      }
      if (request.type === 'restore') {
        const shard = ArabicSearchShard.restore(request.shard)
        shards.set(shard.id, shard)
        return { requestId: request.requestId, ok: true, value: { shardId: shard.id } }
      }
      const shard = shards.get(request.shardId)
      if (request.type === 'drop') {
        shards.delete(request.shardId)
        return { requestId: request.requestId, ok: true, value: null }
      }
      if (!shard) throw new Error(`Unknown search shard: ${request.shardId}`)
      return request.type === 'search'
        ? { requestId: request.requestId, ok: true, value: shard.search(request.query, request.offset, request.limit) }
        : { requestId: request.requestId, ok: true, value: shard.serialize() }
    } catch (error) {
      return { requestId: request.requestId, ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
