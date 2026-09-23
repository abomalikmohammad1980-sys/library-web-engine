import {normalizeArabicSearch,matchesSearchExclusions} from '../../packages/search/src/index'
import {HEADING_RELEASE_NORMALIZER_SOURCE_SHA,normalizeHeadingReleaseText} from './heading_release_normalizer'
import {createHeadingScanCheckpoint} from './heading_scan_scheduler'
import {filterHeadingBookRows,validateHeadingBookRanges,type HeadingBookRanges} from './heading_book_ranges'
import {HeadingPostingLookahead} from './heading_posting_lookahead'
import {visitHeadingRows,HeadingPointerCache} from './heading_row_pipeline'
import {decodeRowBundle,validateRowBundles,type HeadingRowBundles} from './heading_row_bundles'
import {selectHeadingPartitions,type HeadingDictionaryPartitions} from './heading_dictionary_partitions'
const NORMALIZER_SHA=HEADING_RELEASE_NORMALIZER_SOURCE_SHA
type Asset={path:string;bytes:number;sha256:string}
type RowShard=Asset&{firstRow:number;count:number}
type Segment=[number,number,number,number]
type Dictionary=Array<[string,Segment[]]>
type CompactDictionary={words:string[];offsets:Uint32Array;segments:Uint32Array}
type BinaryDictionary=Asset&{encoding:string;gzipBytes:number;gzipSha256:string;wordCount:number;sourceDictionarySha256:string;sourceManifestSha256:string}
type Row=[string,string,string|null,string,number|null,string|null,string|null,number,string|null]
type Manifest={contract:string;coverageComplete:boolean;bookCount:number;rowCount:number;normalizer:{sourceSha256:string};postingsEncoding:string;rows:RowShard[];rowPointers?:RowShard[];rowPointerEncoding?:string;postings:Asset[];dictionary:Asset&{gzipBytes:number;gzipSha256:string;wordCount:number}}
declare const completedDictionaryBrand:unique symbol
export type CentralHeadingDictionarySnapshot=Readonly<{[completedDictionaryBrand]:true}>
const completedDictionaries=new WeakMap<CentralHeadingDictionarySnapshot,{identity:string;manifest:Manifest;compact:CompactDictionary}>()
export type CentralHeadingHit={rowId:number;bookId:string;titleId:string;parentTitleId:string|null;title:string;pageIndex:number|null;pageLabel:string|null;partLabel:string|null;sequence:number;pageSourceId:string|null}
type Options={baseURL:string;fetch?:typeof fetch;maxDictionaryBytes?:number;maxCandidateEntries?:number;maxQueryShardBytes?:number;yieldControl?:()=>Promise<void>;queryTimeoutMs?:number;onMetrics?:(metrics:Record<string,number>)=>void;onStage?:(name:string)=>void;maxRowCacheEntries?:number;preserveCachedRows?:boolean;planTokens?:boolean;compactDictionary?:boolean;dictionaryBinary?:BinaryDictionary;dictionarySnapshot?:CentralHeadingDictionarySnapshot;countMode?:'exact'|'page';rowConcurrency?:number;dictionaryPartitions?:HeadingDictionaryPartitions;rowBundles?:HeadingRowBundles}
const dictionaryIdentity=(options:Options)=>JSON.stringify([options.baseURL.replace(/\/?$/,'/'),options.dictionaryBinary,options.maxDictionaryBytes??32*1024*1024,options.planTokens===true])
const abort=(signal?:AbortSignal)=>signal?.throwIfAborted()
const bad=()=>new Error('heading_search_integrity')
const integer=(n:number)=>Number.isSafeInteger(n)&&n>=0
const assetValid=(asset:Asset)=>integer(asset.bytes)&&/^(rows|postings|dictionary|pointers)\/[a-f0-9]{64}\.(json|bin|json\.gz|compact\.bin\.gz)$/.test(asset.path)&&/^[a-f0-9]{64}$/.test(asset.sha256)
export function headingPhraseWordMatches(word:string,token:string,position:number,total:number){
 // The builder splits the same normalized title at spaces. For a substring
 // phrase its first/last tokens may be partial, but interior tokens cannot.
 return total===1?word.includes(token):position===0?word.endsWith(token):position===total-1?word.startsWith(token):word===token
}
export function decodeBinaryHeadingDictionary(bytes:Uint8Array,wordCount:number):CompactDictionary{
 if(bytes.length<24||new TextDecoder().decode(bytes.subarray(0,8))!=='KHZDICT1')throw bad();const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=view.getUint32(8,true),values=view.getUint32(12,true),textBytes=view.getUint32(16,true),segmentStart=20+(count+1)*4,textStart=segmentStart+values*4
 if(count!==wordCount||values%4||textStart+textBytes!==bytes.length)throw bad();const words=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(textStart)).split('\0');if(words.pop()!==''||words.length!==count||words.some(word=>!word))throw bad()
 const offsets=new Uint32Array(count+1),segments=new Uint32Array(values);for(let i=0;i<=count;i++){const offset=view.getUint32(20+i*4,true);if(offset%4||offset>values||i&&offset<offsets[i-1]!)throw bad();offsets[i]=offset}if(offsets[0]!==0||offsets[count]!==values)throw bad();for(let i=0;i<values;i++)segments[i]=view.getUint32(segmentStart+i*4,true);return{words,offsets,segments}
}
function shardFor(id:number,shards:RowShard[]){let lo=0,hi=shards.length-1;while(lo<=hi){const mid=(lo+hi)>>>1,s=shards[mid]!;if(id<s.firstRow)hi=mid-1;else if(id>=s.firstRow+s.count)lo=mid+1;else return s}throw bad()}
async function digest(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer))].map(n=>n.toString(16).padStart(2,'0')).join('')}
async function bounded(stream:ReadableStream<Uint8Array>|null,limit:number,signal?:AbortSignal){
 if(!stream)throw bad();const reader=stream.getReader(),chunks:Uint8Array[]=[];let total=0
 const stop=()=>{void reader.cancel().catch(()=>undefined)};signal?.addEventListener('abort',stop,{once:true})
 try{for(;;){abort(signal);const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit)throw new Error('heading_search_memory_budget');chunks.push(value)}abort(signal)}catch(error){await reader.cancel().catch(()=>undefined);throw error}finally{signal?.removeEventListener('abort',stop);reader.releaseLock()}
 const bytes=new Uint8Array(total);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return bytes
}
export function decodeHeadingDeltas(bytes:Uint8Array,count:number,rowCount:number):number[]{
 const rows:number[]=[];let value=0,factor=1,previous=0,width=0
 for(const byte of bytes){value+=(byte&127)*factor;width++;if(!Number.isSafeInteger(value)||width>8)throw bad();if(byte&128){factor*=128;continue}const id=previous+value;if(!integer(id)||id>=rowCount||(rows.length>0&&id<=previous))throw bad();rows.push(id);previous=id;value=0;factor=1;width=0}
 if(width||rows.length!==count)throw bad();return rows
}
export class CentralHeadingSearchClient{
 private readonly fetcher:typeof fetch;private readonly base:string;#manifest?:Manifest;private dictionary:Dictionary|undefined;private active=false
 private candidatePageCache?:{query:string;rowIds:number[];workingBytes:number}
 private readonly rowCache=new Map<number,{row:Row;bytes:number}>();private rowCacheBytes=0
 private readonly postingCache=new Map<string,Uint8Array>();private postingCacheBytes=0
 private readonly dictionaryAssetCache=new Map<string,Uint8Array<ArrayBuffer>>();private dictionaryAssetCacheBytes=0
 private rememberPosting(asset:Asset,bytes:Uint8Array){
  const key=`${asset.path}:${asset.sha256}:${asset.bytes}`,previous=this.postingCache.get(key)
  if(previous){this.postingCacheBytes-=previous.length;this.postingCache.delete(key)}
  while(this.postingCacheBytes+bytes.length>8*1024*1024&&this.postingCache.size){const oldest=this.postingCache.keys().next().value!;this.postingCacheBytes-=this.postingCache.get(oldest)!.length;this.postingCache.delete(oldest)}
  this.postingCache.set(key,bytes);this.postingCacheBytes+=bytes.length
 }
 private async postingBytes(asset:Asset,signal?:AbortSignal){
  abort(signal);const key=`${asset.path}:${asset.sha256}:${asset.bytes}`,cached=this.postingCache.get(key)
  if(cached){this.postingCache.delete(key);this.postingCache.set(key,cached);this.timings.postingCacheHits=(this.timings.postingCacheHits??0)+1;return cached}
  const bytes=await this.bytes(asset,1048576,signal);abort(signal)
  // Client/release-local, verified bytes only. No persistence or cross-account data.
  this.rememberPosting(asset,bytes);return bytes
 }
 #compact:CompactDictionary|undefined
 private snapshot?:CentralHeadingDictionarySnapshot
 private partialDictionary=false
 private readonly segmentHashes=new Map<string,string>()
 private readonly verifiedSegments=new Map<string,Uint8Array>()
 private verifiedSegmentBytes=0
 private async partitionSegment(segment:Segment,m:Manifest,signal?:AbortSignal):Promise<Uint8Array>{
  const [index,start,length]=segment,asset=m.postings[index]!,proof=this.segmentHashes.get(segment.join(':'))
  if(!proof||!assetValid(asset)||length<1)throw bad()
  abort(signal)
  const segmentKey=`${asset.path}:${asset.sha256}:${asset.bytes}:${start}:${length}:${proof}`
  const retained=this.verifiedSegments.get(segmentKey)
  if(retained){this.verifiedSegments.delete(segmentKey);this.verifiedSegments.set(segmentKey,retained);this.timings.postingCacheHits=(this.timings.postingCacheHits??0)+1;return retained}
  const key=`${asset.path}:${asset.sha256}:${asset.bytes}`,cached=this.postingCache.get(key)
  if(cached){
   const bytes=cached.slice(start,start+length)
   if(bytes.length!==length||await this.hash(bytes)!==proof)throw bad()
   abort(signal);this.postingCache.delete(key);this.postingCache.set(key,cached)
   this.timings.postingCacheHits=(this.timings.postingCacheHits??0)+1
   return bytes
  }
  const response=await this.fetcher(new URL(asset.path,this.base).href,{headers:{Range:`bytes=${start}-${start+length-1}`},signal:signal??null})
  let bytes:Uint8Array
  if(response.status===200){
   // A stale CDN whole-object entry can ignore Range. Never treat its prefix
   // as the requested segment: verify the complete bounded object, then slice.
   if(asset.bytes>1048576){await response.body?.cancel();throw bad()}
   const whole=await bounded(response.body,asset.bytes,signal)
   if(whole.length!==asset.bytes||await this.hash(whole)!==asset.sha256)throw bad()
   bytes=whole.slice(start,start+length)
   if(bytes.length!==length||await this.hash(bytes)!==proof)throw bad()
   abort(signal);this.rememberPosting(asset,whole)
   this.timings.postingRangeFallbacks=(this.timings.postingRangeFallbacks??0)+1
  }else{
   if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${start+length-1}/${asset.bytes}`){await response.body?.cancel();throw bad()}
   bytes=await bounded(response.body,length,signal)
  }
  if(bytes.length!==length||await this.hash(bytes)!==proof)throw bad()
  abort(signal)
  // Cache only complete, verified public ranges. Bound both bytes and entry
  // count: very common queries can otherwise retain thousands of tiny ranges.
  if(bytes.length<=4*1024*1024){
   while(this.verifiedSegments.size&&(this.verifiedSegmentBytes+bytes.length>4*1024*1024||this.verifiedSegments.size>=4096)){
    const oldest=this.verifiedSegments.keys().next().value!;this.verifiedSegmentBytes-=this.verifiedSegments.get(oldest)!.length;this.verifiedSegments.delete(oldest)
   }
   this.verifiedSegments.set(segmentKey,bytes);this.verifiedSegmentBytes+=bytes.length
  }
  return bytes
 }
 async createDictionarySnapshot(signal?:AbortSignal):Promise<CentralHeadingDictionarySnapshot>{
  if(this.options.dictionaryPartitions)throw Error('heading_search_partition_snapshot_unsupported')
  await this.search('',{...(signal?{signal}:{})});abort(signal)
  if(this.snapshot)return this.snapshot
  if(!this.#manifest||!this.#compact||!this.options.dictionaryBinary)throw Error('heading_search_snapshot_requires_binary')
  // Opaque capability: no buffers, mutable properties, I/O or promises escape.
  const handle=Object.freeze(Object.create(null)) as CentralHeadingDictionarySnapshot
  completedDictionaries.set(handle,{identity:dictionaryIdentity(this.options),manifest:this.#manifest,compact:this.#compact})
  this.snapshot=handle;return handle
 }
 private dictionaryEntry(index:number):[string,Segment[]]{if(!this.#compact)return this.dictionary![index]!;const c=this.#compact,segments:Segment[]=[];for(let i=c.offsets[index]!;i<c.offsets[index+1]!;i+=4)segments.push([c.segments[i]!,c.segments[i+1]!,c.segments[i+2]!,c.segments[i+3]!]);return[c.words[index]!,segments]}
 private timings:Record<string,number>={}
 private async hash(bytes:Uint8Array){const start=performance.now();try{return await digest(bytes)}finally{this.timings.shaMs=(this.timings.shaMs??0)+performance.now()-start}}
 constructor(private readonly options:Options & {bookRanges?:HeadingBookRanges}){this.fetcher=options.fetch??((input,init)=>fetch(input,init));this.base=options.baseURL.replace(/\/?$/,'/');for(const n of [options.maxDictionaryBytes??32*1024*1024,options.maxCandidateEntries??100000,options.maxQueryShardBytes??64*1024*1024])if(!integer(n)||n<1)throw new Error('heading_search_invalid_budget')}
 private async bytes(asset:Asset,max:number,signal?:AbortSignal){
  const started=performance.now()
  abort(signal)
  if(!assetValid(asset)||asset.bytes>max)throw bad()
  const cacheKey=`${asset.path}:${asset.sha256}:${asset.bytes}`,cached=this.dictionaryAssetCache.get(cacheKey)
  if(cached){this.dictionaryAssetCache.delete(cacheKey);this.dictionaryAssetCache.set(cacheKey,cached);this.timings.dictionaryCacheHits=(this.timings.dictionaryCacheHits??0)+1;return cached}
  const response=await this.fetcher(new URL(asset.path,this.base).href,{signal:signal??null});if(!response.ok)throw Error(`heading_search_http_${response.status}`)
  const bytes=await bounded(response.body,asset.bytes,signal);if(bytes.length!==asset.bytes||await this.hash(bytes)!==asset.sha256)throw bad();abort(signal)
  // Release-bound compressed dictionary bytes only, verified before caching.
  // This retained cache has its own 4 MiB cap, separate from query buffers.
  if(asset.path.startsWith('dictionary/')&&bytes.length<=4*1024*1024){
   while(this.dictionaryAssetCacheBytes+bytes.length>4*1024*1024&&this.dictionaryAssetCache.size){const oldest=this.dictionaryAssetCache.keys().next().value!;this.dictionaryAssetCacheBytes-=this.dictionaryAssetCache.get(oldest)!.length;this.dictionaryAssetCache.delete(oldest)}
   this.dictionaryAssetCache.set(cacheKey,bytes);this.dictionaryAssetCacheBytes+=bytes.length
  }
  const key=asset.path.split('/')[0]+'ReadMs';this.timings[key]=(this.timings[key]??0)+performance.now()-started;return bytes
 }
 private async rowRangeBytes(asset:RowShard,from:number,to:number,signal?:AbortSignal):Promise<Uint8Array>{
  for(let attempt=0;;attempt++){
   abort(signal)
   try{
    const response=await this.fetcher(new URL(asset.path,this.base).href,{signal:signal??null,headers:{Range:`bytes=${from}-${to}`},cache:attempt?'reload':'default'})
    if(response.status!==206||response.headers.get('content-range')!==`bytes ${from}-${to}/${asset.bytes}`||response.headers.get('content-length')!==String(to-from+1)){await response.body?.cancel().catch(()=>undefined);throw Error('heading_search_range_unavailable')}
    const bytes=await bounded(response.body,to-from+1,signal);if(bytes.length!==to-from+1)throw bad();abort(signal);return bytes
   }catch(error){
    // Fetch/stream transport failures can be transient even after HTTP 206.
    // Retry only once, bypassing the HTTP cache; invalid ranges and SHA failures
    // are never downgraded, and a superseded query must not create another request.
    if(attempt!==0||signal?.aborted||!(error instanceof TypeError))throw error
   }
  }
 }
 private async initialize(signal?:AbortSignal,terms:string[]=[]){
  if(this.options.dictionaryPartitions&&this.options.dictionarySnapshot)throw bad()
  if(this.partialDictionary){this.dictionary=undefined;this.partialDictionary=false}this.segmentHashes.clear()
  if(this.options.dictionarySnapshot&&!this.#manifest){
   if(this.options.bookRanges&&this.options.bookRanges.manifestSha256!==this.options.dictionaryBinary?.sourceManifestSha256)throw bad()
   const snapshot=completedDictionaries.get(this.options.dictionarySnapshot)
   if(!snapshot||snapshot.identity!==dictionaryIdentity(this.options))throw Error('heading_search_snapshot_invalid')
   abort(signal);this.#manifest=snapshot.manifest;this.#compact=snapshot.compact;this.snapshot=this.options.dictionarySnapshot
  }
  if(!this.#manifest){const response=await this.fetcher(new URL('manifest.json',this.base).href,{signal:signal??null});if(!response.ok)throw Error(`heading_search_http_${response.status}`);const raw=await bounded(response.body,4*1024*1024,signal);if(this.options.dictionaryBinary&&await this.hash(raw)!==this.options.dictionaryBinary.sourceManifestSha256)throw bad();const m=JSON.parse(new TextDecoder().decode(raw)) as Manifest
   if(!['khizana-heading-search/1','khizana-heading-search/2'].includes(m.contract)||m.normalizer?.sourceSha256!==NORMALIZER_SHA||m.postingsEncoding!=='unsigned-leb128-delta-rowid-reset-zero-per-segment'||!integer(m.rowCount)||!integer(m.bookCount)||typeof m.coverageComplete!=='boolean'||!Array.isArray(m.rows)||!Array.isArray(m.postings))throw bad()
   if(m.contract==='khizana-heading-search/2'){if(m.rowPointerEncoding!=='uint32le-offset,uint32le-length,sha256-32'||!Array.isArray(m.rowPointers))throw bad();let next=0;for(const s of m.rowPointers){if(s.firstRow!==next||!integer(s.count)||s.count<1||s.count>1024||s.bytes!==s.count*40||!assetValid(s)||!s.path.startsWith('pointers/'))throw bad();next+=s.count}if(next!==m.rowCount)throw bad()}
   let next=0;for(const shard of m.rows){if(shard.firstRow!==next||!integer(shard.count)||shard.count<1)throw bad();next+=shard.count}if(next!==m.rowCount)throw bad();if(this.options.bookRanges&&await this.hash(raw)!==this.options.bookRanges.manifestSha256)throw bad();this.#manifest=m
  }
  const m=this.#manifest
  if(this.options.bookRanges)validateHeadingBookRanges(this.options.bookRanges,m.rowCount)
  const partitions=this.options.dictionaryPartitions
  if(partitions){
   if(!this.options.planTokens||!this.options.dictionaryBinary||partitions.sourceManifestSha256!==this.options.dictionaryBinary.sourceManifestSha256||partitions.sourceDictionarySha256!==m.dictionary.sha256)throw bad()
   const selected=selectHeadingPartitions(terms,partitions)
   if(selected){
    this.#compact=undefined;this.dictionary=undefined
    const entries=new Map<string,Segment[]>();let totalBytes=0
    for(const index of selected){
     const d=partitions.shards[index]!,max=this.options.maxDictionaryBytes??32*1024*1024
     if(!integer(d.bytes)||!integer(d.wordCount)||d.bytes>max||(totalBytes+=d.bytes)>max)throw bad()
     const gzip=await this.bytes({path:d.path,bytes:d.gzipBytes,sha256:d.gzipSha256},max,signal)
     const plain=await bounded(new Blob([gzip]).stream().pipeThrough(new DecompressionStream('gzip')),d.bytes,signal)
     if(plain.length!==d.bytes||await this.hash(plain)!==d.sha256)throw bad()
     const rows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain)) as Array<[string,Segment[],string[]?]>
     if(!Array.isArray(rows)||rows.length!==d.wordCount)throw bad()
     for(const row of rows){
      if(!Array.isArray(row)||row.length!==(partitions.contract==='khizana-heading-trigrams/2'?3:2)||typeof row[0]!=='string'||!row[0]||!Array.isArray(row[1]))throw bad()
      for(const s of row[1])if(!Array.isArray(s)||s.length!==4||!s.every(integer)||!m.postings[s[0]]||s[1]+s[2]>m.postings[s[0]]!.bytes||s[3]>m.rowCount)throw bad()
      if(partitions.contract==='khizana-heading-trigrams/2'){
       if(!Array.isArray(row[2])||row[2].length!==row[1].length)throw bad()
       row[1].forEach((segment,i)=>{const hash=row[2]![i]!;if(!/^[a-f0-9]{64}$/.test(hash))throw bad();const key=segment.join(':'),old=this.segmentHashes.get(key);if(old&&old!==hash)throw bad();this.segmentHashes.set(key,hash)})
      }
      const previous=entries.get(row[0]);if(previous&&JSON.stringify(previous)!==JSON.stringify(row[1]))throw bad()
      entries.set(row[0],row[1])
     }
    }
    this.dictionary=[...entries];this.partialDictionary=true;this.timings.dictionaryPartitionCount=selected.length;this.timings.dictionaryPartitionWords=entries.size
    return m
   }
  }
  if(!this.#compact&&this.options.dictionaryBinary){const d=this.options.dictionaryBinary,max=this.options.maxDictionaryBytes??32*1024*1024
   if(!this.options.planTokens||d.encoding!=='khizana-heading-dictionary-binary/1'||d.sourceDictionarySha256!==m.dictionary.sha256||d.wordCount!==m.dictionary.wordCount||!integer(d.bytes)||d.bytes>max)throw bad()
   const gzip=await this.bytes({path:d.path,bytes:d.gzipBytes,sha256:d.gzipSha256},max,signal),plain=await bounded(new Blob([gzip]).stream().pipeThrough(new DecompressionStream('gzip')),d.bytes,signal)
   if(plain.length!==d.bytes||await this.hash(plain)!==d.sha256)throw bad();const compact=decodeBinaryHeadingDictionary(plain,d.wordCount);this.options.onStage?.('binaryDictionaryDecoded')
   for(let i=0;i<compact.segments.length;i+=4){abort(signal);if(i%16384===0&&this.options.yieldControl)await this.options.yieldControl();const index=compact.segments[i]!,start=compact.segments[i+1]!,length=compact.segments[i+2]!,count=compact.segments[i+3]!;if(!m.postings[index]||start+length>m.postings[index]!.bytes||count>m.rowCount)throw bad()}
   this.#compact=compact;this.timings.dictionaryCompactBytes=compact.offsets.byteLength+compact.segments.byteLength
  }
  if(!this.dictionary&&!this.#compact){const d=m.dictionary,max=this.options.maxDictionaryBytes??32*1024*1024;if(!integer(d.bytes)||d.bytes>max)throw Error('heading_search_memory_budget')
   const gzip=await this.bytes({path:d.path,bytes:d.gzipBytes,sha256:d.gzipSha256},max,signal),plain=await bounded(new Blob([gzip]).stream().pipeThrough(new DecompressionStream('gzip')),d.bytes,signal)
   if(plain.length!==d.bytes||await this.hash(plain)!==d.sha256)throw bad();const entries=JSON.parse(new TextDecoder().decode(plain)) as Dictionary;this.options.onStage?.('dictionaryParsed')
   if(!Array.isArray(entries)||entries.length!==d.wordCount)throw bad()
   for(const entry of entries){if(!Array.isArray(entry)||typeof entry[0]!=='string'||!entry[0]||!Array.isArray(entry[1]))throw bad();for(const s of entry[1])if(!Array.isArray(s)||s.length!==4||!s.every(integer)||!m.postings[s[0]]||s[1]+s[2]>m.postings[s[0]]!.bytes||s[3]>m.rowCount)throw bad()}
   if(this.options.compactDictionary){if(!this.options.planTokens)throw Error('heading_search_compact_requires_plan');let count=0;for(const entry of entries)count+=entry[1].length*4
    if(!integer(count)||count>0xffffffff||count*4+(entries.length+1)*4>max)throw Error('heading_search_memory_budget')
    const words:string[]=new Array(entries.length),offsets=new Uint32Array(entries.length+1),segments=new Uint32Array(count);let at=0
    for(let i=0;i<entries.length;i++){abort(signal);if(i%4096===0&&this.options.yieldControl)await this.options.yieldControl();const entry=entries[i]!;words[i]=entry[0];offsets[i]=at;for(const s of entry[1])for(const n of s){if(n>0xffffffff)throw bad();segments[at++]=n}}offsets[entries.length]=at;this.#compact={words,offsets,segments};this.timings.dictionaryCompactBytes=offsets.byteLength+segments.byteLength;this.options.onStage?.('dictionaryCompacted')
   }else this.dictionary=entries
  }
  return m
 }
 async search(query:string,options:{offset?:number;limit?:number;bookIds?:readonly string[];excluded?:readonly string[];signal?:AbortSignal}={}){
  abort(options.signal);if(this.active)throw Error('heading_search_busy');this.active=true
  this.timings={};const timeout=this.options.queryTimeoutMs;if(timeout!==undefined&&(!integer(timeout)||timeout<1)){this.active=false;throw Error('heading_search_invalid_deadline')}
  const signal=timeout===undefined?options.signal:AbortSignal.any([AbortSignal.timeout(timeout),...(options.signal?[options.signal]:[])])
  try{return await this.execute(query,{...options,...(signal?{signal}:{})})}finally{this.active=false;this.options.onMetrics?.({...this.timings})}
 }
 private async execute(query:string,{offset=0,limit=20,bookIds,excluded=[],signal}:{offset?:number;limit?:number;bookIds?:readonly string[];excluded?:readonly string[];signal?:AbortSignal}){
  if(!integer(offset)||!integer(limit)||limit>500)throw Error('heading_search_invalid_page')
  const initStart=performance.now(),wanted=normalizeHeadingReleaseText(query),terms=[wanted,...excluded.map(normalizeArabicSearch)].flatMap(value=>value.split(/\s+/).filter(Boolean))
  const cacheable=!bookIds&&!excluded.length&&wanted.split(/\s+/).filter(Boolean).length===1
  const cached=cacheable&&this.candidatePageCache?.query===wanted?this.candidatePageCache:undefined
  if(cached&&(cached.workingBytes>(this.options.maxQueryShardBytes??64*1024*1024)||cached.rowIds.length>(this.options.maxCandidateEntries??100000)))throw Error('heading_search_memory_budget')
  const m=cached&&this.#manifest?this.#manifest:await this.initialize(signal,terms),empty={hits:[] as CentralHeadingHit[],total:0,totalExact:true,coverageComplete:m.coverageComplete,indexedBooks:m.bookCount};this.timings.initializeMs=performance.now()-initStart;if(!wanted||bookIds?.length===0)return empty
  const scanCheckpoint=this.options.yieldControl??createHeadingScanCheckpoint()
  const estimateStart=performance.now(),tokens=wanted.split(/\s+/).filter(Boolean).map((token,position,all)=>({token,matches:(word:string)=>headingPhraseWordMatches(word,token,position,all.length),estimate:0,entries:this.options.planTokens?[] as Dictionary:undefined}))
  if(!cached&&this.options.planTokens){let scanned=0,planned=0;const count=this.#compact?.words.length??this.dictionary!.length;for(let index=0;index<count;index++){abort(signal);if(++scanned%4096===0){await scanCheckpoint();abort(signal)}const word=this.#compact?.words[index]??this.dictionary![index]![0];let entry:[string,Segment[]]|undefined;for(const item of tokens)if(item.matches(word)){if(++planned>(this.options.maxCandidateEntries??100000))throw Error('heading_search_memory_budget');entry??=this.dictionaryEntry(index);item.entries!.push(entry);for(const s of entry[1])item.estimate+=s[3]}}this.timings.estimateDictionaryVisits=scanned}
  else if(!cached)for(const item of tokens){let scanned=0;for(const [word,segments]of this.dictionary!){abort(signal);if(++scanned%4096===0&&this.options.yieldControl){await this.options.yieldControl();abort(signal)}if(item.matches(word))for(const s of segments)item.estimate+=s[3]}}
  tokens.sort((a,b)=>a.estimate-b.estimate);this.timings.estimateMs=performance.now()-estimateStart
  const candidatesStart=performance.now()
  let candidates:Set<number>|undefined=cached?new Set(cached.rowIds):undefined,used=cached?.workingBytes??0;const cache=new Map<number,Uint8Array>(),budget=this.options.maxCandidateEntries??100000
  const lookahead=new HeadingPostingLookahead(cache,index=>{used+=m.postings[index]!.bytes;if(used>(this.options.maxQueryShardBytes??64*1024*1024))throw Error('heading_search_memory_budget')},(index,signal)=>this.postingBytes(m.postings[index]!,signal),signal)
  try{
  // A rare word is already a complete superset of a phrase's matches. When
  // that superset is small, authenticate its rows and check the full phrase
  // directly instead of downloading postings for every common word as well.
  // Keep `tokens` unchanged: the single-word exact-count shortcut is not valid
  // for a phrase. Scope filters, exclusions and phrase order are checked below.
  this.timings.postingTokens=0
  for(const {matches,entries}of cached?[]:tokens){this.timings.postingTokens++;const found=new Set<number>(),sourceEntries=entries??this.dictionary!;let scanned=0
   const narrowSegments=this.segmentHashes.size?sourceEntries.filter(([word])=>matches(word)).flatMap(([,segments])=>segments):[]
   const narrowPositions=new Map(narrowSegments.map((segment,index)=>[segment.join(':'),index]))
   const narrowLookahead=new HeadingPostingLookahead(new Map(),index=>{used+=narrowSegments[index]![2];if(used>(this.options.maxQueryShardBytes??64*1024*1024))throw Error('heading_search_memory_budget')},(index,ownedSignal)=>this.partitionSegment(narrowSegments[index]!,m,ownedSignal),signal,6)
   try{
   for(let entryAt=0;entryAt<sourceEntries.length;entryAt++){const [word,segments]=sourceEntries[entryAt]!;abort(signal);this.timings.unionDictionaryVisits=(this.timings.unionDictionaryVisits??0)+1;if(++scanned%4096===0){await scanCheckpoint();abort(signal)}if(!matches(word))continue;let previous=-1
    for(let segmentAt=0;segmentAt<segments.length;segmentAt++){const [index,start,length,count]=segments[segmentAt]!;let next:number|undefined
     for(let e=entryAt;e<(entries?sourceEntries.length:entryAt+1)&&next===undefined;e++){const parts=sourceEntries[e]![1];for(let at=e===entryAt?segmentAt+1:0;at<parts.length;at++)if(parts[at]![0]!==index){next=parts[at]![0];break}}
     const narrow=this.segmentHashes.size>0
     const position=narrow?narrowPositions.get(segments[segmentAt]!.join(':'))!:0
     const requiredAhead=narrow?Array.from({length:Math.min(5,narrowSegments.length-position-1)},(_,i)=>position+i+1):undefined
     const bytes=narrow?await narrowLookahead.read(position,requiredAhead):await lookahead.read(index,next)
     const decodeStart=performance.now();for(const id of decodeHeadingDeltas(narrow?bytes:bytes.subarray(start,start+length),count,m.rowCount)){if(id<=previous)throw bad();previous=id;if(candidates&&!candidates.has(id))continue;found.add(id);if(found.size+(candidates?.size??0)>budget)throw Error('heading_search_memory_budget')}this.timings.unionMs=(this.timings.unionMs??0)+performance.now()-decodeStart
    }
   }
   }finally{await narrowLookahead.close()}
   candidates=found;if(!found.size){this.timings.candidatesMs=performance.now()-candidatesStart;return empty}
   if(tokens.length>1&&found.size<=16)break
  }
  // A normalized single token cannot span words. Its substring postings are an
  // exact exclusion set; phrases must still be verified in the original row.
  const foldedExclusions=[...new Set(excluded.map(normalizeArabicSearch).filter(Boolean))]
  const plannedExclusions=foldedExclusions.length>0&&foldedExclusions.every(value=>! /\s/.test(value))
  if(plannedExclusions){
   const count=this.#compact?.words.length??this.dictionary!.length
   for(let i=0;i<count;i++){
    abort(signal);if(i%4096===0){await scanCheckpoint();abort(signal)}
    const word=this.#compact?.words[i]??this.dictionary![i]![0]
    if(!foldedExclusions.some(value=>word.includes(value)))continue
    const [,segments]=this.dictionaryEntry(i);let previous=-1
    for(const [index,start,length,n]of segments){
     if(this.segmentHashes.size){used+=length;if(used>(this.options.maxQueryShardBytes??64*1024*1024))throw Error('heading_search_memory_budget');const bytes=await this.partitionSegment([index,start,length,n],m,signal);for(const id of decodeHeadingDeltas(bytes,n,m.rowCount)){if(id<=previous)throw bad();previous=id;candidates!.delete(id)};continue}
     let bytes=cache.get(index)
     if(!bytes){const asset=m.postings[index]!;used+=asset.bytes;if(used>(this.options.maxQueryShardBytes??64*1024*1024))throw Error('heading_search_memory_budget');bytes=await this.postingBytes(asset,signal);cache.set(index,bytes);if(cache.size>2)cache.delete(cache.keys().next().value!)}
     for(const id of decodeHeadingDeltas(bytes.subarray(start,start+length),n,m.rowCount)){if(id<=previous)throw bad();previous=id;candidates!.delete(id)}
    }
   }
  }
  this.timings.candidatesMs=performance.now()-candidatesStart;const rowsStart=performance.now()
  const allOrdered=[...candidates!].sort((a,b)=>a-b)
  if(cacheable&&!cached&&allOrdered.length<=10000)this.candidatePageCache={query:wanted,rowIds:allOrdered,workingBytes:used}
  const scopedByRanges=!!bookIds&&!!this.options.bookRanges
  const ordered=scopedByRanges?filterHeadingBookRows(allOrdered,bookIds!,this.options.bookRanges!):allOrdered,single=tokens.length===1&&(!bookIds||scopedByRanges)&&(!foldedExclusions.length||plannedExclusions)&&wanted===tokens[0]!.token,selected=single?ordered.slice(offset,offset+limit):ordered,wantedIds=new Set(selected),books=bookIds?new Set(bookIds):null,hits:CentralHeadingHit[]=[];let total=single?ordered.length:0
  const consume=(rowId:number,row:Row)=>{
   if(!Array.isArray(row)||row.length!==9||typeof row[0]!=='string'||typeof row[1]!=='string'||typeof row[3]!=='string'||!(row[4]===null||integer(row[4])))throw bad()
   const matches=normalizeHeadingReleaseText(row[3]).includes(wanted);if(single&&!matches)throw bad();if(!matches||books&&!books.has(row[0])||matchesSearchExclusions(row[3],excluded))return
   const position=single?0:total++;if(single||position>=offset&&hits.length<limit)hits.push({rowId,bookId:row[0],titleId:row[1],parentTitleId:row[2],title:row[3],pageIndex:row[4],pageLabel:row[5],partLabel:row[6],sequence:row[7],pageSourceId:row[8]})
  }
  if(m.contract==='khizana-heading-search/2'){
   const pointers=new HeadingPointerCache<Uint8Array>(),pending=new Map<string,Promise<Uint8Array>>(),retained=this.options.preserveCachedRows?new Map(this.rowCache):undefined,maxRows=this.options.maxRowCacheEntries??256
   if(!integer(maxRows)||maxRows<1||maxRows>256)throw Error('heading_search_invalid_budget')
   const charge=(n:number)=>{used+=n;if(used>(this.options.maxQueryShardBytes??64*1024*1024))throw Error('heading_search_memory_budget')}
   const bundleConfig=this.options.rowBundles,bundleCache=new Map<number,{rows:Row[];bytes:number}>(),bundleTasks=new Map<number,Promise<Row[]>>();let bundleBytes=0
   if(bundleConfig){validateRowBundles(bundleConfig,this.options.dictionaryBinary?.sourceManifestSha256);if(bundleConfig.rowCount!==m.rowCount)throw bad()}
   const bundleRow=async(id:number)=>{
    const d=bundleConfig!,index=Math.floor(id/d.rowsPerBundle),cached=bundleCache.get(index)
    if(cached)return cached.rows[id%d.rowsPerBundle]!
    let task=bundleTasks.get(index)
    if(!task){task=(async()=>{
     const response=await this.fetcher(new URL(`${index}.json`,d.baseURL.replace(/\/?$/,'/')).href,{signal:signal??null});if(!response.ok)throw Error(`heading_search_http_${response.status}`)
     const bytes=await bounded(response.body,4194304,signal);charge(bytes.length)
     const rows=await decodeRowBundle(new TextDecoder('utf-8',{fatal:true}).decode(bytes),index,d) as Row[];abort(signal)
     while(bundleBytes+bytes.length>4194304&&bundleCache.size){const oldest=bundleCache.keys().next().value!;bundleBytes-=bundleCache.get(oldest)!.bytes;bundleCache.delete(oldest)}
     bundleCache.set(index,{rows,bytes:bytes.length});bundleBytes+=bytes.length;this.timings.rowBundleRequests=(this.timings.rowBundleRequests??0)+1;return rows
    })().finally(()=>bundleTasks.delete(index));bundleTasks.set(index,task)}
    return (await task)[id%d.rowsPerBundle]!
   }
   const windows=new Map<string,Uint8Array>(),windowTasks=new Map<string,Promise<Uint8Array>>()
   const window=async(asset:RowShard,start:number,length:number)=>{
    // Small aligned windows amortize HTTP latency across nearby TOC rows.
    // Only the requested row is decoded, with its own authenticated SHA.
    const from=length>16384?start:Math.floor(start/16384)*16384,to=Math.min(asset.bytes,Math.max(from+16384,start+length))-1,key=`${asset.path}:${from}:${to}`
    let task=windowTasks.get(key);const cached=windows.get(key);if(cached)return cached.subarray(start-from,start-from+length)
    if(!task){charge(to-from+1);task=(async()=>{
     const bytes=await this.rowRangeBytes(asset,from,to,signal)
     windows.set(key,bytes);while(windows.size>4)windows.delete(windows.keys().next().value!);return bytes
    })().finally(()=>windowTasks.delete(key));windowTasks.set(key,task)}
    const bytes=await task;return bytes.subarray(start-from,start-from+length)
   }
   const pointer=async(s:RowShard)=>{const cached=pointers.get(s.path);if(cached)return cached;let flight=pending.get(s.path);if(!flight){charge(s.bytes);flight=this.bytes(s,40960,signal).then(bytes=>{pointers.set(s.path,s.firstRow,bytes);return bytes}).finally(()=>pending.delete(s.path));pending.set(s.path,flight)}return flight}
   const read=async(id:number)=>{abort(signal);const cached=retained?.get(id)??this.rowCache.get(id);if(cached){if(!retained){this.rowCache.delete(id);this.rowCache.set(id,cached)}this.timings.rowCacheHits=(this.timings.rowCacheHits??0)+1;return cached.row}
    if(bundleConfig){const row=await bundleRow(id),length=new TextEncoder().encode(JSON.stringify(row)).length;this.rowCache.set(id,{row,bytes:length});this.rowCacheBytes+=length;while(this.rowCache.size>maxRows||this.rowCacheBytes>4*1024*1024){const oldest=[...this.rowCache.keys()].find(key=>!retained?.has(key))??this.rowCache.keys().next().value!;this.rowCacheBytes-=this.rowCache.get(oldest)!.bytes;this.rowCache.delete(oldest)}return row}
    const s=shardFor(id,m.rowPointers!),p=await pointer(s),at=(id-s.firstRow)*40,view=new DataView(p.buffer,p.byteOffset,p.byteLength),start=view.getUint32(at,true),length=view.getUint32(at+4,true),asset=shardFor(id,m.rows)
    if(!assetValid(asset)||!asset.path.startsWith('rows/')||!length||length>1048576||start+length>asset.bytes)throw bad()
    const bytes=await window(asset,start,length),sha=[...p.subarray(at+8,at+40)].map(n=>n.toString(16).padStart(2,'0')).join('');if(bytes.length!==length||await this.hash(bytes)!==sha)throw bad();abort(signal);const row=JSON.parse(new TextDecoder().decode(bytes)) as Row
    this.rowCache.set(id,{row,bytes:length});this.rowCacheBytes+=length;while(this.rowCache.size>maxRows||this.rowCacheBytes>4*1024*1024){const oldest=[...this.rowCache.keys()].find(key=>!retained?.has(key))??this.rowCache.keys().next().value!;this.rowCacheBytes-=this.rowCache.get(oldest)!.bytes;this.rowCache.delete(oldest)}return row
   }
   const concurrency=this.options.rowConcurrency??4
   if(!integer(concurrency)||concurrency<1||concurrency>16)throw Error('heading_search_invalid_budget')
   // Refill as each ordered row is consumed, not after the slowest row of a
   // fixed batch. Exact order/count and the same request bound are preserved.
   const processed=await visitHeadingRows(selected,concurrency,read,consume,()=>this.options.countMode==='page'&&!single&&total>offset+limit,signal)
   this.timings.rowsMs=performance.now()-rowsStart;return {...empty,hits,total,totalExact:single||processed===selected.length}
  }
  for(const shard of m.rows){abort(signal);if(!selected.some(id=>id>=shard.firstRow&&id<shard.firstRow+shard.count))continue;used+=shard.bytes;if(used>(this.options.maxQueryShardBytes??64*1024*1024))throw Error('heading_search_memory_budget')
   const rows=JSON.parse(new TextDecoder().decode(await this.bytes(shard,1048576,signal))) as Row[];if(!Array.isArray(rows)||rows.length!==shard.count)throw bad()
   for(let i=0;i<rows.length;i++){const rowId=shard.firstRow+i;if(wantedIds.has(rowId))consume(rowId,rows[i]!)}
  }
  this.timings.rowsMs=performance.now()-rowsStart;return {...empty,hits,total}
  }finally{await lookahead.close()}
 }
}
