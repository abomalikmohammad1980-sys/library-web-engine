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
  author?: string
  deathYearHijri?: number
  pageLabel?: string
  partLabel?: string
  sectionHeading?: string
}

export interface SearchPage {
  total: number
  offset: number
  limit: number
  hits: SearchHit[]
}

export interface AdvancedSearchQuery { query:string; excluded:string[] }

/** محلل خطّي لعبارات الاقتباس والكلمات المسبوقة بشرطة للاستبعاد. */
export function parseAdvancedSearchQuery(raw:string):AdvancedSearchQuery{
  const input=raw.slice(0,1024),included:string[]=[],excluded:string[]=[]
  let index=0
  while(index<input.length){
    while(index<input.length&&/\s/u.test(input[index]!))index++
    if(index>=input.length)break
    let omit=false
    if(input[index]==='-'&&index+1<input.length&&!/\s/u.test(input[index+1]!)){omit=true;index++}
    const quoted=input[index]==='"';if(quoted)index++
    let token=''
    while(index<input.length){
      const char=input[index]!
      if(char==='\\'&&index+1<input.length&&(input[index+1]==='"'||input[index+1]==='\\')){token+=input[index+1];index+=2;continue}
      if(quoted&&char==='"'){index++;break}
      if(!quoted&&/\s/u.test(char))break
      token+=char;index++
    }
    token=token.trim()
    if(token)(omit?excluded:included).push(token)
  }
  const uniqueExcluded=[...new Map(excluded.map(value=>[normalizeArabicSearch(value),value] as const)).values()]
  return{query:included.join(' ').replace(/\s+/gu,' ').trim(),excluded:uniqueExcluded}
}

export function matchesSearchExclusions(text:string,excluded:readonly string[]):boolean{
  if(!excluded.length)return false
  const normalized=normalizeArabicSearch(text)
  return excluded.some(value=>{const wanted=normalizeArabicSearch(value);return Boolean(wanted)&&normalized.includes(wanted)})
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
        const mapped=normalizeArabicSearchWithMap(document.text)
        hits.push({ ...document, matchOffset:mapped.originalOffsets[matchOffset]??0 })
      }
      total += 1
    }
    return { total, offset: safeOffset, limit: safeLimit, hits }
  }
}

export function normalizeArabicSearch(value: string): string {
  // No offset array is needed while verifying candidate pages. Keep casing
  // point-wise (not whole-string casing, which changes Greek final sigma).
  // Casing runs after separators so expansions such as İ -> i + dot survive.
  return value
    .replace(/[\(\[\{﴿（]\s*[0-9٠-٩۰-۹]+\s*[\)\]\}﴾）]/gu,' ')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim()
    .replace(/\p{Changes_When_Lowercased}/gu,point=>point.toLocaleLowerCase('ar'))
    .replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي')
}

export interface NormalizedArabicSearch { text:string; originalOffsets:number[] }
/** تطبيع بحث مع خريطة تعيد كل محرف مطبّع إلى موضعه في النص الأصلي للإبراز. */
export function normalizeArabicSearchWithMap(value:string):NormalizedArabicSearch{
  return foldArabicSearch(value,true)
}
// Bound the cache: arbitrary imported Unicode must not grow it indefinitely.
const searchCharacterFolds=new Map<string,string>()
function foldArabicSearch(value:string,withOffsets:boolean):NormalizedArabicSearch{
  const ignoredNotes=/^[\(\[\{﴿（]\s*[0-9٠-٩۰-۹]+\s*[\)\]\}﴾）]/u
  let text='',separator=false;const originalOffsets:number[]=[]
  for(let index=0;index<value.length;){const note='([{﴿（'.includes(value[index]!)?ignoredNotes.exec(value.slice(index)):null;if(note){separator=Boolean(text);index+=note[0].length;continue}const point=value.codePointAt(index)!,raw=String.fromCodePoint(point),width=raw.length;index+=width
    if(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/u.test(raw))continue
    let folded=searchCharacterFolds.get(raw)
    if(folded===undefined){folded=raw.toLocaleLowerCase('ar').replace(/[أإآٱ]/u,'ا').replace(/ى/u,'ي');if(searchCharacterFolds.size<4096)searchCharacterFolds.set(raw,folded)}
    if(!/[\p{L}\p{N}]/u.test(folded)){separator=Boolean(text);continue}
    if(separator&&text&&!text.endsWith(' ')){text+=' ';if(withOffsets)originalOffsets.push(index-width)}separator=false
    text+=folded;if(withOffsets)for(let i=0;i<folded.length;i++)originalOffsets.push(index-width)
  }
  return{text,originalOffsets}
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
