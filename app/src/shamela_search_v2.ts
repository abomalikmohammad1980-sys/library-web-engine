import type { SearchHit } from '../../packages/search/src/index'
import { normalizeArabicSearch, normalizeArabicSearchWithMap } from '../../packages/search/src/index'
import { cleanShamelaPlainText, remapShamelaPlainTextOffset } from './shamela_text_presentation'
import { PackedTermCache } from './packed_term_cache'
import { assembleVerifiedPackedParts } from './verified_packed_parts'
import { PackedPartTransport } from './packed_part_transport'
import { loadPackedParts } from './packed_parts_parallel'
import { PackedTermDirectoryLite } from './packed_term_directory_lite'
import {createTrustedMerkleDirectory,snapshotMerkleOptIn} from './packed_term_directory_provider'
import type {PackedTermDirectoryMerkle} from './packed_term_directory_merkle'
import {bindSearchRecovery,snapshotSearchRecovery,type SearchRecoveryConfig} from './search_recovery_binding'
import { loadSearchFieldOverlay } from './search_field_overlay'
import {pinBokActiveRelease,pinnedBokSearchConfig,pinnedBokSearchManifestHash} from './bok_active_release'
import { searchFieldPostingPage } from './search_field_posting_page'
import { searchFieldTokenSourceRange } from './search_field_source_snippet'
import { loadFieldRawRows } from './search_field_raw_rows'
import { snippetPhraseOffsets } from './search_phrase_snippet_matches'
import { searchProgressDownload } from './search_progress_download'

export type SeparatedV2SearchBinding = { manifestUrl: string; manifestSha256: string; sourceIndexSha256: string; packedReleaseId: string; packedManifestSha256: string; expectedBooks: number; expectedSegments: number; sourceRows?: {manifestUrl:string;manifestSha256:string} }

type Manifest={contract:string;buckets?:number;bucketCount?:number;postingBucketCount?:number;coverageComplete:boolean;counts?:{books:number};routePattern:string;postingPattern?:string;postingFiles?:Array<{id:string;file:string;byteLength:number}>;batchTermPattern?:string;batchSnippetPattern?:string;segmentTermPattern?:string;segmentSnippetPattern?:string;batches?:string[];segments?:string[]}
type Posting=[string,number[],number?]
type GlobalPosting=[string,number[],number|undefined,string]
type Snippet=[string,string,number,string,string?,number?,number?,string?,string?]
type PackedPart={archive:string;project:number;offset:number;length:number;sha256:string}
type PackedEntry={byteLength:number;sha256:string;parts:PackedPart[]}
type LiteDirectoryState={key:string;reader:PackedTermDirectoryLite;accountedBytes:number}
type PackedManifest={contract:string;releaseId:string;coverageComplete:boolean;counts:{segments:number;expectedSegments:number;books:number;documents:number;positions:number};indexBucketCount:number;indexPattern:string;termIndexBucketCount?:number;termIndexPattern?:string;termCount?:number;termIndexFiles?:Array<{id:string;path:string;entries:number;byteLength:number;sha256:string}>;source:{postingBucketCount:number;postingPattern:string;segmentSnippetPattern:string;bucketCount:number}}
type PackedConfig={controlBaseUrl:string;projectBaseUrls:string[];compressedParts?:boolean;termDirectoryMerkle?:unknown;sourceRecovery?:unknown}
export function packedSearchConfigAllowedOnHost(config:PackedConfig,host=globalThis.location?.hostname):boolean{const local=host==='localhost'||host==='127.0.0.1'||host==='[::1]';return !local||[config.controlBaseUrl,...config.projectBaseUrls].every(url=>/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/)/u.test(url))}
const ROOT='./library/shamela-search-v2/'
const localPackedConfig=(host=globalThis.location?.hostname):PackedConfig|undefined=>host==='localhost'||host==='127.0.0.1'||host==='[::1]'?{controlBaseUrl:'http://127.0.0.1:4200/control',projectBaseUrls:Array.from({length:8},(_,index)=>`http://127.0.0.1:${4200+index}`)}:undefined
export const searchV2BucketFor=(value:string,count:number)=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return String((h>>>0)%count).padStart(Math.max(4,String(Math.max(0,count-1)).length),'0')}
const bucketFor=searchV2BucketFor
const intersection=(sets:Set<string>[])=>{if(!sets.length)return new Set<string>();const ordered=[...sets].sort((a,b)=>a.size-b.size),out=new Set(ordered[0]);for(const value of out)if(ordered.some(set=>!set.has(value)))out.delete(value);return out}
const adjacent=(positions:number[][])=>{if(!positions.length)return false;let anchor=0;for(let i=1;i<positions.length;i++)if(positions[i]!.length<positions[anchor]!.length)anchor=i;const sets=positions.map((list,index)=>index===anchor?undefined:new Set(list));return positions[anchor]!.some(start=>positions.every((_,index)=>index===anchor||sets[index]!.has(start+index-anchor)))}
export const shouldLoadAdditionalPackedPosting=(candidateCount:number,entryBytes:number)=>candidateCount>2_000&&entryBytes<=160*1024*1024
export const choosePackedPhraseAnchor=(_words:string[],entries:Array<{byteLength:number}>)=>entries.reduce((best,entry,index)=>entry.byteLength<entries[best]!.byteLength?index:best,0)
const snippetHit=(row:Snippet,query:string):SearchHit=>{const text=cleanShamelaPlainText(row[3]),normalized=normalizeArabicSearchWithMap(text),wanted=normalizeArabicSearch(query),foldedOffset=normalized.text.indexOf(wanted),matchOffset=foldedOffset<0?0:(normalized.originalOffsets[foldedOffset]??0);return{id:row[0],bookId:row[1],paragraphIndex:row[2],text,matchOffset,...(row[4]?{author:row[4]}:{}),...(row[5]!=null?{deathYearHijri:row[5]}:{}),...(row[6]!=null?{pageLabel:String(row[6])}:{}),...(row[7]?{sectionHeading:cleanShamelaPlainText(row[7])}:{}),...(row[8]!=null?{partLabel:String(row[8])}:{})}}

export class ShamelaSearchV2Client{
  /** Explicit release binding only; never activates an incomplete candidate. */
  async searchSeparated(query:string,scope:'body'|'foot',binding:SeparatedV2SearchBinding,offset=0,limit=100,bookIds?:string[],signal?:AbortSignal){
    const config={...binding},check=()=>signal?.throwIfAborted(),before=this.bytesFetched
    check()
    if(scope!=='body'&&scope!=='foot')throw Error('search_field_scope_invalid')
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error('search_field_page_range')
    const packed=await this.getPackedManifest(),manifest=await this.getManifest()
    check()
    if(!packed||packed.releaseId!==config.packedReleaseId||this.packedManifestSha256!==config.packedManifestSha256||!manifest.coverageComplete||packed.counts.books!==config.expectedBooks||packed.counts.segments!==config.expectedSegments)throw Error('search_field_release_mismatch')
    const overlay=await loadSearchFieldOverlay(config,this.fetcher)
    if(!overlay.coverageComplete)throw Error('search_field_coverage_incomplete')
    if(overlay.counts.documents!==packed.counts.documents||overlay.counts.positions!==packed.counts.positions)throw Error('search_field_release_counts')
    const rawRows=config.sourceRows?await loadFieldRawRows(config.sourceRows,config.manifestSha256,config.expectedBooks,overlay.counts.documents,this.fetcher):undefined
    if(bookIds){const covered=new Set(overlay.coveredBookIds);if(bookIds.some(id=>!covered.has(id)))throw Error('search_field_scope_unavailable')}
    const words=normalizeArabicSearch(query).split(' ').filter(Boolean)
    if(!words.length)throw Error('search_field_query_empty')
    const merkle=await this.merkleDirectory(packed),lite=merkle?undefined:this.liteDirectory(packed)
    if(!merkle&&!lite&&!this.hasCompleteTermDirectory(packed))throw Error('search_field_term_directory_unavailable')
    const lists:GlobalPosting[][]=[]
    for(const word of words){
      check()
      const entry=merkle?await merkle.lookup(word):lite?await this.liteTermEntry(word,lite):await this.packedTermEntry(word,packed)
      if(!entry)return{hits:[],total:0,totalDocuments:0,totalOccurrences:0,indexedBooks:config.expectedBooks,coverageComplete:true,networkBytes:this.bytesFetched-before}
      lists.push((await this.packedTermValue(word,packed,entry))[1])
    }
    await this.ensureRecovery();check()
    const allowed=bookIds?new Set(bookIds):undefined,maps=lists.map(rows=>new Map(rows.map(row=>[row[0],row] as const))),anchor=lists.reduce((best,rows,index)=>rows.length<lists[best]!.length?index:best,0)
    const segments=new Map<string,string>()
    const candidates=lists[anchor]!.filter(row=>this.documentAllowed(row[0])&&(!allowed||allowed.has(row[0].split(':')[0]!))&&maps.every(map=>map.has(row[0]))).map(row=>{segments.set(row[0],row[3]);return{id:row[0],positionsByQueryWord:maps.map(map=>map.get(row[0])![1]),...(row[2]===undefined?{}:{deathYearHijri:row[2]})}})
    const sourceRows=new Map<string,Snippet>(),pattern=manifest.segmentSnippetPattern??manifest.batchSnippetPattern?.replace('{batch}','{segment}')
    if(!pattern)throw Error('search_field_snippet_pattern')
    const page=await searchFieldPostingPage({query,scope,offset,limit,candidates,boundaries:overlay,coverage:{complete:true,unavailableBookIds:[]},...(signal?{signal}:{}),hydrate:async id=>{
      check()
      const path=pattern.replace('{segment}',segments.get(id)!).replace('{bucket}',bucketFor(id,manifest.bucketCount??manifest.buckets??512))
      const row=(await this.snippetRows(path,new Set([id]))).find(row=>row[0]===id)
      if(!row)throw Error('search_field_snippet_missing')
      const boundaries=await overlay.book(id.split(':')[0]!)
      if(!boundaries)throw Error('search_field_boundary_missing')
      sourceRows.set(id,row)
      if(rawRows){
        const source=await rawRows.row(id,scope)
        // Preserve token/position proof even when presentation snippets omit
        // headings or were clipped. Never infer ownership from display text.
        searchFieldTokenSourceRange(source.fullText,boundaries.tokenRange(id,scope))
        return source
      }
      return{fullText:row[3],range:searchFieldTokenSourceRange(row[3],boundaries.tokenRange(id,scope))}
    }})
    check()
    if(!page.coverageComplete)throw Error('search_field_coverage_incomplete')
    const hits=page.hits.map(hit=>({...snippetHit(sourceRows.get(hit.id)!,query),text:cleanShamelaPlainText(hit.text),matchOffset:remapShamelaPlainTextOffset(hit.text,hit.matchOffset),occurrenceCount:hit.occurrenceCount}))
    return{...page,hits,total:page.totalOccurrences,indexedBooks:config.expectedBooks,networkBytes:this.bytesFetched-before}
  }
  private recoveryConfig:SearchRecoveryConfig|undefined
  private recoveryTask:ReturnType<typeof bindSearchRecovery>|undefined
  private recoveredExclusions:ReadonlySet<string>=new Set()
  get hasSourceRecovery():boolean{return this.recoveryConfig!==undefined}
  private documentAllowed(id:string):boolean{return !this.recoveredExclusions.has(id)}
  /** Central boundary for candidate hydration; default keeps the verified bucket transport. */
  private async snippetRows(path:string,wanted:ReadonlySet<string>):Promise<Snippet[]>{
    if(this.recoveryConfig){
      const recovery=await this.ensureRecovery(),remaining=new Set(wanted),restored:Snippet[]=[]
      for(const bookId of new Set([...wanted].map(id=>id.split(':')[0]!))){
        for(const row of (await recovery!.reader.book(bookId)).values())if(wanted.has(row[0])){
          const snippet:Snippet=[row[0],row[1],row[2],row[3],row[4]]
          if(row[5]!==null)snippet[5]=row[5];if(row[6]!==null)snippet[6]=row[6];snippet[7]=row[7];if(row[8]!==null)snippet[8]=row[8]
          restored.push(snippet);remaining.delete(row[0])
        }
      }
      if(!remaining.size)return restored
      const value=await this.get<{entries:Snippet[]}>(path),rows=value.entries.filter(row=>remaining.has(row[0])),found=new Set(rows.map(row=>row[0]))
      if(found.size!==remaining.size||rows.length!==found.size)throw Error('shamela_search_snippet_rows_missing_or_duplicate')
      return [...restored,...rows]
    }
    const value=await this.get<{entries:Snippet[]}>(path)
    const rows=value.entries.filter(row=>wanted.has(row[0])),found=new Set(rows.map(row=>row[0]))
    if(found.size!==wanted.size||rows.length!==found.size)throw Error('shamela_search_snippet_rows_missing_or_duplicate')
    return rows
  }
  private liteDirectoryState?:LiteDirectoryState
  private merkleOptIn?:unknown
  private merkleControlBaseUrl?:string
  private packedManifestSha256?:string
  private merkleDirectoryTask?:Promise<PackedTermDirectoryMerkle|undefined>
  private packedTransport = new PackedPartTransport((input,init)=>this.fetcher(input,init))
  private packedTerms = new PackedTermCache<[string, GlobalPosting[]]>()
  private manifest?:Promise<Manifest>;private cache=new Map<string,Promise<unknown>>;private scopeKeys=new WeakMap<string[],number>();private nextScopeKey=0;private searchPages=new Map<string,Promise<{total:number;hits:SearchHit[];networkBytes:number;indexedBooks:number;coverageComplete:boolean}>>;private packedManifest?:Promise<PackedManifest|null>;private packedArchives=new Map<string,Promise<Uint8Array>>;private packedMissingPaths=new Set<string>();private packedMissingRevision=0;public bytesFetched=0
  constructor(private readonly fetcher:typeof fetch=(input,init)=>globalThis.fetch(input,init),recovery?:SearchRecoveryConfig){this.recoveryConfig=snapshotSearchRecovery(recovery??this.packedConfig()?.sourceRecovery)}
  private async ensureRecovery(){
    if(!this.recoveryConfig)return undefined
    if(!this.recoveryTask){
      const task=(async()=>{const packed=await this.getPackedManifest();if(!packed)throw Error('shamela_recovery_packed_missing');const bound=await bindSearchRecovery(this.recoveryConfig!,{releaseId:packed.releaseId,sha256:this.packedManifestSha256??'',documents:packed.counts.documents,positions:packed.counts.positions},this.fetcher,bytes=>this.sha256(bytes));this.recoveredExclusions=bound.excluded;return bound})()
      this.recoveryTask=task;void task.catch(()=>{if(this.recoveryTask===task)this.recoveryTask=undefined})
    }
    return this.recoveryTask
  }
  private merkleDirectory(manifest:PackedManifest){return this.merkleDirectoryTask??=createTrustedMerkleDirectory(this.merkleOptIn,{manifest,manifestSha256:this.packedManifestSha256??'',controlBaseUrl:this.merkleControlBaseUrl??this.packedConfig()!.controlBaseUrl,fetch:(input,init)=>this.fetcher(input,init),onBytes:bytes=>{this.bytesFetched+=bytes}})}
  private liteDirectory(manifest:PackedManifest):LiteDirectoryState|undefined{
    const raw=(manifest as PackedManifest&{termDirectoryLite?:unknown}).termDirectoryLite
    if(raw===undefined)return undefined
    const descriptor=raw&&typeof raw==='object'?raw as Record<string,unknown>:undefined
    // Old manifests (and explicitly unsupported future formats) retain V1
    // term-directory routing. A malformed recognized opt-in is not absence.
    if(typeof descriptor?.contract==='string'&&descriptor.contract!=='khizana-term-directory-lite/1')return undefined
    if(!descriptor||descriptor.contract!=='khizana-term-directory-lite/1'||descriptor.releaseId!==manifest.releaseId||typeof descriptor.rootSha256!=='string'||!/^[a-f0-9]{64}$/.test(descriptor.rootSha256)||typeof descriptor.basePath!=='string'||!/^term-directory-lite\/[a-zA-Z0-9_-]+$/.test(descriptor.basePath))throw Error('shamela_search_v2_lite_optin_invalid')
    const baseUrl=`${this.packedConfig()!.controlBaseUrl.replace(/\/$/u,'')}/${descriptor.basePath}`,key=`${manifest.releaseId}:${descriptor.rootSha256}:${baseUrl}`
    if(this.liteDirectoryState?.key!==key){this.liteDirectoryState?.reader.dispose();this.liteDirectoryState={key,reader:new PackedTermDirectoryLite({baseUrl,rootSha256:descriptor.rootSha256,releaseId:manifest.releaseId,fetch:(input,init)=>this.fetcher(input,init)}),accountedBytes:0}}
    return this.liteDirectoryState
  }
  private async liteTermEntry(word:string,state:LiteDirectoryState):Promise<PackedEntry|null>{
    // V2 page promises are shared. Keep the existing caller-level cancellation
    // boundary; do not attach one subscriber's signal to everyone else's read.
    try{return await state.reader.lookup(word)}finally{const bytes=state.reader.stats.bytes;this.bytesFetched+=bytes-state.accountedBytes;state.accountedBytes=bytes}
  }
  private packedConfig():PackedConfig|undefined{const configured=pinnedBokSearchConfig()??(globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:PackedConfig}).__SHAMELA_SEARCH_V2_PACKED__,config=configured??localPackedConfig();return config&&packedSearchConfigAllowedOnHost(config)?config:undefined}
  private async sha256(bytes:Uint8Array){const owned=bytes.slice().buffer as ArrayBuffer;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',owned))].map(x=>x.toString(16).padStart(2,'0')).join('')}
  private async packedEntry(path:string,manifest:PackedManifest):Promise<PackedEntry>{const config=this.packedConfig()!,indexId=bucketFor(path,manifest.indexBucketCount),index=await this.rawJson<{entries:Array<[string,PackedEntry]>}>(`${config.controlBaseUrl.replace(/\/$/u,'')}/${manifest.indexPattern.replace('{bucket}',indexId)}?v=${encodeURIComponent(manifest.releaseId)}`),entry=index.entries.find(x=>x[0]===path)?.[1];if(!entry)throw new Error('shamela_search_v2_packed_key_missing');return entry}
  private hasCompleteTermDirectory(manifest:PackedManifest):boolean{
    const files=manifest.termIndexFiles,count=manifest.termIndexBucketCount;
    return Boolean(manifest.coverageComplete&&manifest.counts?.segments===manifest.counts?.expectedSegments&&count&&files?.length===count&&new Set(files.map(f=>f.id)).size===count&&files.every(f=>f.path===manifest.termIndexPattern?.replace('{bucket}',f.id)&&Number.isSafeInteger(f.entries)&&f.entries>=0&&f.byteLength>0&&/^[a-f0-9]{64}$/u.test(f.sha256))&&files.reduce((n,f)=>n+f.entries,0)===manifest.termCount)
  }
  private async packedTermEntry(word:string,manifest:PackedManifest):Promise<PackedEntry|undefined>{
    if(!manifest.termIndexPattern||!manifest.termIndexBucketCount)return undefined;
    const config=this.packedConfig()!,indexId=bucketFor(word,manifest.termIndexBucketCount),path=manifest.termIndexPattern.replace('{bucket}',indexId),url=`${config.controlBaseUrl.replace(/\/$/u,'')}/${path}?v=${encodeURIComponent(manifest.releaseId)}`;
    if(!this.hasCompleteTermDirectory(manifest)){const index=await this.rawJson<{entries:Array<[string,PackedEntry]>}>(url);return index.entries.find(entry=>entry[0]===word)?.[1]}
    const file=manifest.termIndexFiles!.find(f=>f.id===indexId&&f.path===path);
    if(!file)throw Error('shamela_search_v2_term_inventory_invalid');
    const key=`verified-term:${url}:${file.sha256}`;let cached=this.cache.get(key);
    if(!cached){cached=(async()=>{
      const bytes=await searchProgressDownload((input,init)=>this.fetcher(input,init),url,file.byteLength);this.bytesFetched+=bytes.byteLength
      if(bytes.length!==file.byteLength||await this.sha256(bytes)!==file.sha256)throw Error('shamela_search_v2_term_directory_integrity');
      const index=JSON.parse(new TextDecoder().decode(bytes)) as {contract:string;entries:Array<[string,PackedEntry]>};
      if(index.contract!=='shamela-search-v2/packed-term-index-1'||!Array.isArray(index.entries)||index.entries.length!==file.entries||index.entries.some(row=>!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||bucketFor(row[0],manifest.termIndexBucketCount!)!==indexId||!row[1]||!Number.isSafeInteger(row[1].byteLength)||row[1].byteLength<=0||!Array.isArray(row[1].parts)||!row[1].parts.length)||new Set(index.entries.map(row=>row[0])).size!==index.entries.length)throw Error('shamela_search_v2_term_directory_invalid');
      return index;
    })().catch(error=>{this.cache.delete(key);throw error});this.cache.set(key,cached)}
    const index=await cached as {entries:Array<[string,PackedEntry]>};return index.entries.find(entry=>entry[0]===word)?.[1];
  }
  private async packedTermValue(word:string,manifest:PackedManifest,entry:PackedEntry):Promise<[string,GlobalPosting[]]>{return this.packedTerms.get(manifest.releaseId,word,entry.byteLength,async()=>{const config=this.packedConfig()!,chunks=await loadPackedParts(entry.parts,async part=>{const base=config.projectBaseUrls[part.project];if(!base)throw new Error('shamela_search_v2_packed_project_missing');const bytes=await this.packedTransport.read(base,part,manifest.releaseId,bytes=>this.sha256(bytes),globalThis.location?.origin,config.compressedParts===true);this.bytesFetched+=bytes.byteLength;return bytes});const out=await assembleVerifiedPackedParts(chunks,entry,bytes=>this.sha256(bytes));const row=JSON.parse(new TextDecoder().decode(out)) as [string,GlobalPosting[]];if(row[0]!==word)throw new Error('shamela_search_v2_packed_term_mismatch');return row})}
private loadPackedManifest(){return this.packedManifest??=(async()=>{await pinBokActiveRelease(this.fetcher);const config=this.packedConfig();if(!config)return null;this.merkleOptIn=snapshotMerkleOptIn(config.termDirectoryMerkle);this.merkleControlBaseUrl=config.controlBaseUrl;try{const localHost=globalThis.location?.hostname==='localhost'||globalThis.location?.hostname==='127.0.0.1'||globalThis.location?.hostname==='[::1]',response=await this.fetcher(`${config.controlBaseUrl.replace(/\/$/u,'')}/manifest.json`,localHost?{signal:AbortSignal.timeout(2_000)}:undefined);if(!response.ok){if(this.merkleOptIn!==undefined||pinnedBokSearchManifestHash())throw Error('shamela_search_v2_merkle_manifest_http');return null}const bytes=new Uint8Array(await response.arrayBuffer());this.bytesFetched+=bytes.byteLength;this.packedManifestSha256=await this.sha256(bytes);if(pinnedBokSearchManifestHash()&&pinnedBokSearchManifestHash()!==this.packedManifestSha256)throw Error('bok_search_manifest_mismatch');const value=JSON.parse(new TextDecoder().decode(bytes)) as PackedManifest;if(value.contract==='shamela-search-v2/packed-manifest-1'&&value.coverageComplete)return value;if(this.merkleOptIn!==undefined||pinnedBokSearchManifestHash())throw Error('shamela_search_v2_merkle_manifest_invalid');return null}catch(error){if(this.merkleOptIn!==undefined||pinnedBokSearchManifestHash())throw error;return null}})()}
  private async getPackedManifest(){
    const pending=this.loadPackedManifest()
    try{const result=await pending;if(!result&&this.packedManifest===pending)delete this.packedManifest;return result}
    catch(error){if(this.packedManifest===pending)delete this.packedManifest;throw error}
  }
  private async packedBytes(path:string,manifest:PackedManifest):Promise<Uint8Array>{const config=this.packedConfig()!,entry=await this.packedEntry(path,manifest),chunks=await loadPackedParts(entry.parts,async part=>{const base=config.projectBaseUrls[part.project];if(!base)throw new Error('shamela_search_v2_packed_project_missing');const bytes=await this.packedTransport.read(base,part,manifest.releaseId,bytes=>this.sha256(bytes),globalThis.location?.origin,config.compressedParts===true);this.bytesFetched+=bytes.byteLength;return bytes});return assembleVerifiedPackedParts(chunks,entry,bytes=>this.sha256(bytes))}
  private async rawJson<T>(url:string):Promise<T>{let cached=this.cache.get(url);if(!cached){cached=(async()=>{let networkError:unknown;for(const cache of ['force-cache','reload'] as const){let response:Response;try{response=await this.fetcher(url,{cache})}catch(error){networkError=error;continue}if(!response.ok){if(cache==='reload')throw new Error(`shamela_search_v2_http_${response.status}:${url}`);continue}const mime=response.headers.get('content-type')?.toLowerCase()??'',declaredLength=Number(response.headers.get('content-length')??NaN);if(mime.includes('json')&&Number.isFinite(declaredLength)&&declaredLength>=0){try{const value=await response.json() as T;this.bytesFetched+=declaredLength;return value}catch(error){if(cache==='reload')throw new Error(`shamela_search_v2_json_invalid:${url}`,{cause:error});continue}}const bytes=new Uint8Array(await response.arrayBuffer()),text=new TextDecoder().decode(bytes);this.bytesFetched+=bytes.byteLength;if(mime.includes('text/html')||/^\s*<!doctype\s+html/i.test(text)||/^\s*<html/i.test(text)){if(cache==='reload')throw new Error(`shamela_search_v2_spa_fallback:${url}`);continue}try{return JSON.parse(text) as T}catch(error){if(cache==='reload')throw new Error(`shamela_search_v2_json_invalid:${url}`,{cause:error})}}throw new Error(`shamela_search_v2_unavailable:${url}`,networkError===undefined?undefined:{cause:networkError})})().catch(error=>{this.cache.delete(url);throw error});this.cache.set(url,cached)}return cached as Promise<T>}
  private async staticJsonSize(path:string,maxBytes=8*1024*1024):Promise<number|null>{const url=`${ROOT}${path}`;try{const head=await this.fetcher(url,{method:'HEAD',cache:'force-cache'}),length=Number(head.headers.get('content-length')??NaN);if(!head.ok||!Number.isFinite(length)||length<=0||length>maxBytes)return null;return length}catch{return null}}
  private async get<T>(path:string):Promise<T>{let cached=this.cache.get(path);if(!cached){cached=(async()=>{const packed=await this.getPackedManifest();if(packed){if(path==='manifest.json')return{contract:'shamela-search-v2/manifest-3',coverageComplete:true,counts:packed.counts,...packed.source};try{const value=JSON.parse(new TextDecoder().decode(await this.packedBytes(path,packed)));this.packedMissingPaths.delete(path);return value}catch(error){if(error instanceof Error&&error.message==='shamela_search_v2_packed_archive_missing'){this.packedMissingPaths.add(path);this.packedMissingRevision++;this.cache.delete(path);return{entries:[]} as T}if(!(error instanceof Error&&error.message==='shamela_search_v2_packed_range_ignored'))throw error;return this.rawJson<T>(`${ROOT}${path}`)}}return this.rawJson<T>(`${ROOT}${path}`)})();this.cache.set(path,cached)}return cached as Promise<T>}
  private getManifest(){return this.manifest??=(async()=>{const packed=await this.getPackedManifest();if(packed)return this.get<Manifest>('manifest.json');return this.get<Manifest>('manifest-lite.json').catch(()=>this.get<Manifest>('manifest.json'))})()}
  search(query:string,offset=0,limit=40,bookIds?:string[],completeResults=false):Promise<{total:number;hits:SearchHit[];networkBytes:number;indexedBooks:number;coverageComplete:boolean}>{this.searchPages??=new Map;let scopeKey=0;if(bookIds){this.scopeKeys??=new WeakMap<string[],number>();this.nextScopeKey??=0;scopeKey=this.scopeKeys.get(bookIds)??++this.nextScopeKey;this.scopeKeys.set(bookIds,scopeKey)}const key=`${normalizeArabicSearch(query)}\u0000${offset}\u0000${limit}\u0000${scopeKey}\u0000${completeResults}`;let cached=this.searchPages.get(key);if(!cached){const missingRevision=this.packedMissingRevision;cached=this.searchUncached(query,offset,limit,bookIds,completeResults).then(page=>{const coverageComplete=this.packedMissingPaths.size===0&&missingRevision===this.packedMissingRevision;if(!coverageComplete)this.searchPages.delete(key);return{...page,coverageComplete}}).catch(error=>{this.searchPages.delete(key);delete this.manifest;delete this.packedManifest;delete this.merkleDirectoryTask;delete this.liteDirectoryState;this.cache.clear();throw error});this.searchPages.set(key,cached)}return cached}
  async searchComplete(query:string,offset=0,limit=40,bookIds?:string[]){
    // A single-token posting already carries the complete count. Loading every
    // matching page text here can exhaust a phone on common words; materialize
    // only the requested page while keeping the complete posting count.
    if(normalizeArabicSearch(query).split(' ').filter(Boolean).length<2)return this.search(query,Math.max(0,offset),Math.max(0,Math.min(500,limit)),bookIds,true)
    const full=await this.search(query,0,Number.MAX_SAFE_INTEGER,bookIds,true)
    return{...full,hits:full.hits.slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,Math.min(500,limit)))}
  }
  private async selectivePackedPhrase(query:string,words:string[],manifest:Manifest,allowed:(id:string)=>boolean,offset:number,limit:number,before:number,completeResults=false):Promise<{total:number;hits:SearchHit[];networkBytes:number;indexedBooks:number}|null>{
    const packed=await this.getPackedManifest();if(!packed||words.length<1||!manifest.postingPattern||!manifest.postingBucketCount)return null
    // Prefer exact-word postings whenever the release provides them. Fetching
    // broad buckets first both adds a dependency round-trip and can download
    // unrelated words just because their combined size is below a threshold.
    const paths=words.map(word=>manifest.postingPattern!.replace('{bucket}',bucketFor(word,manifest.postingBucketCount!)))
    const merkle=await this.merkleDirectory(packed),lite=merkle?undefined:this.liteDirectory(packed)
    const termEntries=merkle?await Promise.all(words.map(word=>merkle.lookup(word))):lite?await Promise.all(words.map(word=>this.liteTermEntry(word,lite))):packed.termIndexPattern&&packed.termIndexBucketCount?await Promise.all(words.map(word=>this.packedTermEntry(word,packed))):[]
    // A verified complete directory proves absence; network failures must throw,
    // and legacy/incomplete directories retain their existing posting fallback.
    if(termEntries.length===words.length&&termEntries.some(entry=>entry==null)&&(merkle||lite||this.hasCompleteTermDirectory(packed)))return{total:0,hits:[],networkBytes:this.bytesFetched-before,indexedBooks:manifest.counts?.books??0}
    if(words.length===1&&termEntries[0]){
      const rows=(await this.packedTermValue(words[0]!,packed,termEntries[0]))[1].filter(row=>allowed(row[0]))
      rows.sort((a,b)=>(a[2]??Number.POSITIVE_INFINITY)-(b[2]??Number.POSITIVE_INFINITY))
      const start=Math.max(0,offset),end=start+Math.max(0,Math.min(500,limit)),selected:GlobalPosting[]=[]
      let total=0
      // Count every occurrence, but materialize only the requested page. A
      // verified exact-term entry makes the broad multi-word bucket redundant.
      for(const row of rows){const next=total+row[1].length;for(let i=Math.max(total,start);i<Math.min(next,end);i++)selected.push(row);total=next}
      const pattern=manifest.segmentSnippetPattern??manifest.batchSnippetPattern!.replace('{batch}','{segment}')
      const byPath=new Map<string,Set<string>>(),loaded=new Map<string,Snippet>()
      for(const row of selected){
        const path=pattern.replace('{segment}',row[3]).replace('{bucket}',bucketFor(row[0],manifest.bucketCount??manifest.buckets??512))
        const wanted=byPath.get(path)??new Set<string>();wanted.add(row[0]);byPath.set(path,wanted)
      }
      await Promise.all([...byPath].map(async([path,wanted])=>{for(const snippet of await this.snippetRows(path,wanted))loaded.set(snippet[0],snippet)}))
      const hits=selected.map(row=>{
        const snippet=loaded.get(row[0])
        return snippet?snippetHit(snippet,query):undefined
      }).filter((hit):hit is SearchHit=>hit!=null)
      return{total,hits,networkBytes:this.bytesFetched-before,indexedBooks:manifest.counts?.books??0}
    }
    if(words.length<2)return null
    const usesTermDirectory=termEntries.length===words.length&&termEntries.every((entry):entry is PackedEntry=>entry!=null)
    const entries=usesTermDirectory?termEntries:await Promise.all(paths.map(path=>this.packedEntry(path,packed)))
    const anchor=choosePackedPhraseAnchor(words,entries),totalBytes=entries.reduce((sum,entry)=>sum+entry.byteLength,0)
    if(globalThis.location?.hostname==='localhost'||globalThis.location?.hostname==='127.0.0.1')console.debug(`shamela_v2_selective ${JSON.stringify({phase:'anchor',ms:Math.round(performance.now()),anchor:words[anchor],anchorBytes:entries[anchor]!.byteLength,totalBytes})}`)
    // حتى العبارات التي يقل مجموع posting buckets لها عن 64MB قد تكون بطيئة
    // جدًا إذا نزّلناها كلها (ظهر ذلك حيًا في «فهو يسعى إلى حياة»). يكفي أن
    // يكون أصغر bucket صالحًا كمرساة انتقائية؛ التحقق النهائي من العبارة يتم
    // على النصوص نفسها، لذلك لا نحتاج مسار التنزيل الكامل لضمان الدقة.
    if(entries[anchor]!.byteLength>8*1024*1024)return null
    const anchorRows=usesTermDirectory?(await this.packedTermValue(words[anchor]!,packed,entries[anchor]!))[1]:(await this.get<{entries:Array<[string,GlobalPosting[]]>}>(paths[anchor]!)).entries.find(x=>x[0]===words[anchor])?.[1]??[],candidate=new Map(anchorRows.filter(row=>allowed(row[0])).map(row=>[row[0],row] as const));
    // إذا كان مجموع postings صغيرًا نسبيًا لكن المرساة واسعة، فالمسار الكامل
    // أسرع من فتح مئات/آلاف snippet buckets (مثل «الحج عرفة»). أما المرساة
    // الضيقة فتبقى انتقائية حتى لا ننزّل مئات الميغابايت لعبارة نادرة.
    if(!usesTermDirectory&&totalBytes<64*1024*1024&&candidate.size>256)return null
    for(const index of entries.map((entry,index)=>({entry,index})).filter(x=>x.index!==anchor).sort((a,b)=>a.entry.byteLength-b.entry.byteLength).map(x=>x.index)){
      if(usesTermDirectory?(candidate.size===0||(candidate.size<=64&&entries[index]!.byteLength>64*1024)||entries[index]!.byteLength>16*1024*1024):!shouldLoadAdditionalPackedPosting(candidate.size,entries[index]!.byteLength))break
      const rows=usesTermDirectory?new Map((await this.packedTermValue(words[index]!,packed,entries[index]!))[1].map(row=>[row[0],row] as const)):new Map(((await this.get<{entries:Array<[string,GlobalPosting[]]>}>(paths[index]!)).entries.find(x=>x[0]===words[index])?.[1]??[]).map(row=>[row[0],row] as const)),delta=index-anchor
      for(const [id,anchorRow] of candidate){
        const row=rows.get(id);if(!row){candidate.delete(id);continue}
        const positions=new Set(row[1]),surviving=anchorRow[1].filter(position=>positions.has(position+delta))
        // Each additional term must agree with the SAME surviving phrase start.
        // Clone the row: posting caches are shared with later queries.
        if(!surviving.length)candidate.delete(id)
        else candidate.set(id,[anchorRow[0],surviving,anchorRow[2],anchorRow[3]])
      }
    }
    if(globalThis.location?.hostname==='localhost'||globalThis.location?.hostname==='127.0.0.1')console.debug(`shamela_v2_selective ${JSON.stringify({phase:'candidates',count:candidate.size})}`);if(!candidate.size)return{total:0,hits:[],networkBytes:this.bytesFetched-before,indexedBooks:manifest.counts?.books??0}
    const snippetPattern=manifest.segmentSnippetPattern??manifest.batchSnippetPattern!.replace('{batch}','{segment}'),matches:Array<{row:Snippet;death:number;id:string;matchOffset:number}>=[],target=Math.max(1,Math.max(0,offset)+Math.max(0,Math.min(completeResults?Number.MAX_SAFE_INTEGER:500,limit))),ordered=[...candidate].sort((a,b)=>(a[1][2]??Number.POSITIVE_INFINITY)-(b[1][2]??Number.POSITIVE_INFINITY)||a[0].localeCompare(b[0]));let cursor=0,loadedPaths=0
    while(cursor<ordered.length&&matches.length<target){
      const cohort=ordered.slice(cursor,cursor+Math.min(64,target-matches.length)),byPath=new Map<string,Set<string>>()
      for(const[id,row]of cohort){const path=snippetPattern.replace('{segment}',row[3]).replace('{bucket}',bucketFor(id,manifest.bucketCount??manifest.buckets??512)),ids=byPath.get(path)??new Set<string>();ids.add(id);byPath.set(path,ids)}
      loadedPaths+=byPath.size
      await Promise.all([...byPath].map(async([path,wanted])=>{
        for(const row of await this.snippetRows(path,wanted)){
          const posting=candidate.get(row[0])!
          for(const matchOffset of snippetPhraseOffsets(row[3],query))matches.push({row,death:posting[2]??Number.POSITIVE_INFINITY,id:row[0],matchOffset})
        }
      }))
      cursor+=cohort.length
    }
    if(globalThis.location?.hostname==='localhost'||globalThis.location?.hostname==='127.0.0.1')console.debug(`shamela_v2_selective ${JSON.stringify({phase:'progressive-snippets',paths:loadedPaths,candidates:cursor,matches:matches.length})}`);matches.sort((a,b)=>a.death-b.death||a.id.localeCompare(b.id)||a.matchOffset-b.matchOffset);const selected=matches.slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,Math.min(completeResults?Number.MAX_SAFE_INTEGER:500,limit))),hits=selected.map(match=>({...snippetHit(match.row,query),matchOffset:match.matchOffset})),partial=cursor<ordered.length;return{total:partial?Math.max(matches.length,candidate.size):matches.length,hits,networkBytes:this.bytesFetched-before,indexedBooks:Math.max(0,(manifest.counts?.books??0)-(partial?1:0))}
  }
  private async selectiveSmallStaticPhrase(query:string,words:string[],manifest:Manifest,allowed:(id:string)=>boolean,offset:number,limit:number,before:number,completeResults=false):Promise<{total:number;hits:SearchHit[];networkBytes:number;indexedBooks:number}|null>{
    const started=performance.now(),trace=(phase:string,extra:Record<string,unknown>={})=>{if(globalThis.location?.hostname==='localhost'||globalThis.location?.hostname==='127.0.0.1')console.debug(`shamela_v2_static ${JSON.stringify({phase,ms:Math.round(performance.now()-started),...extra})}`)}
    if(words.length<2||!manifest.postingPattern||!manifest.postingBucketCount)return null
    // لا ننزّل buckets كبيرة داخل المتصفح: تحليل ملفين بحجم 15MB جمّد
    // أول بحث حي بدل تسريعه. المسار الموجّه أدناه هو البديل الآمن لهذه
    // العبارات، بينما تبقى postings الصغيرة مفيدة للعبارات النادرة.
    const count=manifest.bucketCount??manifest.buckets??512,maxPostingBytes=8*1024*1024,knownPostingSizes=new Map((manifest.postingFiles??[]).map(file=>[file.file,file.byteLength] as const)),postingCandidates=await Promise.all(words.map(async(word,index)=>{const path=manifest.postingPattern!.replace('{bucket}',bucketFor(word,manifest.postingBucketCount!)),knownSize=knownPostingSizes.get(path);return{word,index,path,size:knownSize!=null&&knownSize>0&&knownSize<=maxPostingBytes?knownSize:knownSize!=null?null:await this.staticJsonSize(path,maxPostingBytes)}}))
    const sizedPostings=postingCandidates.filter((item):item is typeof item&{size:number}=>item.size!==null).sort((a,b)=>a.size-b.size),loadablePostings=words.length<=3?sizedPostings:sizedPostings.slice(0,2)
    trace('posting-heads',{available:loadablePostings.length,anchors:loadablePostings.map(item=>item.word),sizes:loadablePostings.map(item=>item.size)})
    if(loadablePostings.length<(words.length<=3?1:2))return null
    const rows=await Promise.all(loadablePostings.map(item=>this.rawJson<{entries:Array<[string,GlobalPosting[]]>}>(`${ROOT}${item.path}`))),postingOptions=rows.map((value,rowIndex)=>{const item=loadablePostings[rowIndex]!;return{index:item.index,map:new Map((value.entries.find(entry=>entry[0]===words[item.index])?.[1]??[]).filter(row=>allowed(row[0])).map(row=>[row[0],row] as const))}}).sort((a,b)=>a.map.size-b.map.size).slice(0,2),anchorIndexes=postingOptions.map(item=>item.index),postings=postingOptions.map(item=>item.map),candidates=new Map<string,GlobalPosting>()
    trace('posting-anchors',{anchors:anchorIndexes.map(index=>words[index]),counts:postings.map(posting=>posting.size)})
    // مرساة واحدة واسعة لا تختصر العبارة مهما كان عدد كلماتها؛ فتح آلاف
    // snippet buckets بعدها أبطأ كثيرًا من الفهرس الموجّه الذي يستعمل بقية
    // كلمات العبارة (ظهر حيًا في «إنما الأعمال بالنيات»: 9006 مرشحًا).
    if(postings.length===1&&postings[0]!.size>512)return null
    if(postings.length===1)for(const[id,row]of postings[0]!)candidates.set(id,row)
    else{const anchor=postings[0]!.size<=postings[1]!.size?0:1,other=anchor===0?1:0,delta=anchorIndexes[other]!-anchorIndexes[anchor]!;for(const[id,row]of postings[anchor]!){const otherRow=postings[other]!.get(id);if(!otherRow)continue;const positions=new Set(otherRow[1]);if(row[1].some(position=>positions.has(position+delta)))candidates.set(id,row)}}
    trace('candidates',{count:candidates.size})
    const snippetPattern=manifest.segmentSnippetPattern??manifest.batchSnippetPattern!.replace('{batch}','{segment}'),wanted=normalizeArabicSearch(query),found:Array<{hit:SearchHit;death:number}>=[],ordered=[...candidates].sort((a,b)=>(a[1][2]??Number.POSITIVE_INFINITY)-(b[1][2]??Number.POSITIVE_INFINITY)||a[0].localeCompare(b[0])),target=Math.max(1,Math.max(0,offset)+Math.max(0,Math.min(completeResults?Number.MAX_SAFE_INTEGER:500,limit))),local=globalThis.location?.hostname==='localhost'||globalThis.location?.hostname==='127.0.0.1',cohortSize=local?48:ordered.length;let candidateCursor=0,loadedPaths=0
    // في الصفحة الأولى المحلية لا حاجة لفتح كل ملفات snippets (بلغت 118
    // طلبًا لعبارة واحدة). نقرأ المرشحين الأقدم على دفعات حتى تمتلئ الصفحة؛
    // الصفحات التالية تواصل من الترتيب نفسه، وتبقى التغطية معلنة كأولية.
    while(candidateCursor<ordered.length&&found.length<target){const cohort=ordered.slice(candidateCursor,candidateCursor+cohortSize),byPath=new Map<string,Set<string>>();for(const[id,row]of cohort){const path=snippetPattern.replace('{segment}',row[3]).replace('{bucket}',bucketFor(id,count)),ids=byPath.get(path)??new Set<string>();ids.add(id);byPath.set(path,ids)}const paths=[...byPath.keys()];loadedPaths+=paths.length;await Promise.all(paths.map(async path=>{const ids=byPath.get(path)!,value=await this.get<{entries:Snippet[]}>(path);for(const row of value.entries)if(ids.has(row[0])&&normalizeArabicSearch(cleanShamelaPlainText(row[3])).includes(wanted)){const posting=candidates.get(row[0]);found.push({hit:snippetHit(row,query),death:posting?.[2]??Number.POSITIVE_INFINITY})}}));candidateCursor+=cohort.length}
    const partial=candidateCursor<ordered.length;trace('snippets',{paths:loadedPaths,matches:found.length,partial})
    found.sort((a,b)=>a.death-b.death||a.hit.id.localeCompare(b.hit.id));const selected=found.slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,Math.min(completeResults?Number.MAX_SAFE_INTEGER:500,limit))).map(item=>item.hit),indexedBooks=Math.max(0,(manifest.counts?.books??0)-(partial?1:0))
    return{total:partial?Math.max(found.length,candidates.size):found.length,hits:selected,networkBytes:this.bytesFetched-before,indexedBooks}
  }
  private async searchUncached(query:string,offset=0,limit=40,bookIds?:string[],completeResults=false):Promise<{total:number;hits:SearchHit[];networkBytes:number;indexedBooks:number}>{
    const before=this.bytesFetched,started=performance.now(),trace=(phase:string,extra:Record<string,unknown>={})=>{if(globalThis.location?.hostname==='localhost'||globalThis.location?.hostname==='127.0.0.1')console.debug(`shamela_v2_phase ${JSON.stringify({phase,ms:Math.round(performance.now()-started),bytes:this.bytesFetched-before,...extra})}`)},manifest=await this.getManifest();trace('manifest');if(!manifest.coverageComplete)throw new Error('shamela_search_v2_incomplete')
    await this.ensureRecovery()
    const wanted=bookIds?.length?new Set(bookIds):undefined,allowed=(id:string)=>this.documentAllowed(id)&&(!wanted||wanted.has(id.slice(0,id.indexOf(':')))),words=normalizeArabicSearch(query).split(' ').filter(Boolean),count=manifest.bucketCount??manifest.buckets??512;if(!words.length)return{total:0,hits:[],networkBytes:this.bytesFetched-before,indexedBooks:manifest.counts?.books??0}
    const packedAvailable=Boolean(await this.getPackedManifest())
    if(!packedAvailable){const staticSelective=await this.selectiveSmallStaticPhrase(query,words,manifest,allowed,offset,limit,before,completeResults);if(staticSelective){trace('static-selective',{words:words.length,total:staticSelective.total});return staticSelective}}
    // Global posting buckets are intentionally large. They are efficient only
    // when the packed range service can return the few required byte ranges.
    // If that service is unavailable (the normal fully-local/offline case),
    // use the small routed segment index below instead of downloading an entire
    // 100MB+ posting bucket and leaving the UI apparently frozen.
    if(manifest.postingPattern&&manifest.postingBucketCount&&(packedAvailable||!manifest.routePattern)){
      const selective=await this.selectivePackedPhrase(query,words,manifest,allowed,offset,limit,before,completeResults);if(selective){trace('selective',{words:words.length,total:selective.total});return selective}
      type GlobalPostingValue={pos:number[];death?:number;segment:string}
      const rows=await Promise.all(words.map(async word=>{const path=manifest.postingPattern!.replace('{bucket}',bucketFor(word,manifest.postingBucketCount!)),value=await this.get<{entries:Array<[string,GlobalPosting[]]>}>(path);return value.entries.find(x=>x[0]===word)?.[1]??[]}));trace('postings',{words:words.length});let anchor=0;for(let i=1;i<rows.length;i++)if(rows[i]!.length<rows[anchor]!.length)anchor=i
      const anchorIds=new Set(rows[anchor]!.filter(x=>allowed(x[0])).map(x=>x[0])),maps=rows.map((row,index)=>index===anchor?new Map<string,GlobalPostingValue>(row.filter(x=>allowed(x[0])).map(([id,pos,death,segment])=>[id,{pos,...(death==null?{}:{death}),segment}])):new Map<string,GlobalPostingValue>(row.filter(x=>anchorIds.has(x[0])).map(([id,pos,death,segment])=>[id,{pos,...(death==null?{}:{death}),segment}]))),matches:string[]=[],matchSegment=new Map<string,string>(),matchDeath=new Map<string,number>()
      for(const id of anchorIds){const values=maps.map(map=>map.get(id));if(!values.every(Boolean))continue;const positions=values.map(x=>x!.pos),anchorPositions=positions[anchor]!,sets=positions.map((list,index)=>index===anchor?undefined:new Set(list)),occurrences=anchorPositions.filter(start=>positions.every((_,index)=>index===anchor||sets[index]!.has(start+index-anchor))).length;if(occurrences){const first=values[0]!;for(let occurrence=0;occurrence<occurrences;occurrence++)matches.push(id);matchSegment.set(id,first.segment);if(first.death!=null)matchDeath.set(id,first.death)}}
      matches.sort((a,b)=>(matchDeath.get(a)??Number.POSITIVE_INFINITY)-(matchDeath.get(b)??Number.POSITIVE_INFINITY))
      const snippetPattern=manifest.segmentSnippetPattern??manifest.batchSnippetPattern!.replace('{batch}','{segment}'),selected=matches.slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,Math.min(completeResults?Number.MAX_SAFE_INTEGER:500,limit)))
      const byPath=new Map<string,Set<string>>(),loaded=new Map<string,Snippet>()
      for(const id of selected){const path=snippetPattern.replace('{segment}',matchSegment.get(id)!).replace('{bucket}',bucketFor(id,count));const ids=byPath.get(path)??new Set<string>();ids.add(id);byPath.set(path,ids)}
      await Promise.all([...byPath].map(async([path,ids])=>{for(const row of await this.snippetRows(path,ids))loaded.set(row[0],row)}))
      const hits=selected.map(id=>{const row=loaded.get(id);if(!row)throw new Error('shamela_search_snippet_rows_missing_or_duplicate');return snippetHit(row,query)});trace('snippets',{selected:selected.length,hits:hits.length,total:matches.length})
      return{total:matches.length,hits,networkBytes:this.bytesFetched-before,indexedBooks:manifest.counts?.books??0}
    }
    const routedWordIndexes=words.length>=4?words.map((word,index)=>({word,index})).sort((a,b)=>b.word.length-a.word.length).slice(0,2).map(item=>item.index):words.map((_,index)=>index),routes=await Promise.all(routedWordIndexes.map(async index=>{const word=words[index]!,path=manifest.routePattern.replace('{bucket}',bucketFor(word,count)),value=await this.get<{entries:Array<[string,string[]]>}>(path);return new Set(value.entries.find(x=>x[0]===word)?.[1]??[])}))
    const segments=intersection(routes),matches:string[]=[],matchSegment=new Map<string,string>(),matchDeath=new Map<string,number>(),termPattern=manifest.segmentTermPattern??manifest.batchTermPattern!.replace('{batch}','{segment}'),snippetPattern=manifest.segmentSnippetPattern??manifest.batchSnippetPattern!.replace('{batch}','{segment}')
    // Long exact phrases previously opened every term bucket in every routed
    // segment. A seven-word query could therefore download hundreds of shards
    // before producing its first useful result. Two rare terms are a complete
    // document-level prefilter: every exact phrase must contain both, then the
    // snippet text itself remains the authority for the full phrase match.
    if(words.length>=4&&segments.size){const anchors=routedWordIndexes,candidates=new Map<string,string>(),segmentList=[...segments];for(let cursor=0;cursor<segmentList.length;cursor+=128)await Promise.all(segmentList.slice(cursor,cursor+128).map(async segment=>{const maps=await Promise.all(anchors.map(async index=>{const path=termPattern.replace('{segment}',segment).replace('{bucket}',bucketFor(words[index]!,count)),value=await this.get<{entries:Array<[string,Posting[]]>}>(path);return new Map((value.entries.find(x=>x[0]===words[index])?.[1]??[]).map(row=>[row[0],row] as const))}));for(const [id,row]of maps[0]!)if(allowed(id)&&maps[1]!.has(id)){candidates.set(id,segment);if(row[2]!=null)matchDeath.set(id,row[2])}}));trace('routed-prefilter',{segments:segments.size,candidates:candidates.size,anchors:anchors.length});const byPath=new Map<string,Set<string>>();for(const[id,segment]of candidates){const path=snippetPattern.replace('{segment}',segment).replace('{bucket}',bucketFor(id,count)),ids=byPath.get(path)??new Set<string>();ids.add(id);byPath.set(path,ids)}const found:SearchHit[]=[],paths=[...byPath.keys()];for(const cursor of Array.from({length:Math.ceil(paths.length/128)},(_,index)=>index*128)){await Promise.all(paths.slice(cursor,cursor+128).map(async path=>{const wanted=byPath.get(path)!,value=await this.get<{entries:Snippet[]}>(path);for(const row of value.entries)if(wanted.has(row[0])&&normalizeArabicSearch(cleanShamelaPlainText(row[3])).includes(normalizeArabicSearch(query)))found.push(snippetHit(row,query))}))}found.sort((a,b)=>(a.deathYearHijri??matchDeath.get(a.id)??Number.POSITIVE_INFINITY)-(b.deathYearHijri??matchDeath.get(b.id)??Number.POSITIVE_INFINITY)||a.id.localeCompare(b.id));const selected=found.slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,Math.min(completeResults?Number.MAX_SAFE_INTEGER:500,limit)));trace('routed-snippets',{paths:byPath.size,total:found.length,hits:selected.length});return{total:found.length,hits:selected,networkBytes:this.bytesFetched-before,indexedBooks:manifest.counts?.books??0}}
    for(const segment of segments){const rows=await Promise.all(words.map(async word=>{const path=termPattern.replace('{segment}',segment).replace('{bucket}',bucketFor(word,count)),value=await this.get<{entries:Array<[string,Posting[]]>}>(path);return value.entries.find(x=>x[0]===word)?.[1]??[]})),termMaps=rows.map(row=>new Map(row.map(([id,pos])=>[id,pos])));for(const id of intersection(termMaps.map(map=>new Set(map.keys()))))if(adjacent(termMaps.map(map=>map.get(id)!))){matches.push(id);matchSegment.set(id,segment);const death=rows[0]?.find(x=>x[0]===id)?.[2];if(death!=null)matchDeath.set(id,death)}}
    matches.sort((a,b)=>(matchDeath.get(a)??Number.POSITIVE_INFINITY)-(matchDeath.get(b)??Number.POSITIVE_INFINITY))
    const selected=matches.slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,Math.min(completeResults?Number.MAX_SAFE_INTEGER:500,limit))),hits:SearchHit[]=[]
    // ابحث عن الوثيقة في bucket المحسوب من هويتها؛ لا يُنزّل نص الكتاب أو الشارد الكامل.
    for(const id of selected){const segment=matchSegment.get(id)!;const path=snippetPattern.replace('{segment}',segment).replace('{bucket}',bucketFor(id,count)),value=await this.get<{entries:Snippet[]}>(path),row=value.entries.find(x=>x[0]===id);if(row)hits.push(snippetHit(row,query))}
    return{total:matches.length,hits,networkBytes:this.bytesFetched-before,indexedBooks:manifest.counts?.books??0}
  }
}
