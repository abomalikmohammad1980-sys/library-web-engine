import {it,expect} from 'vitest'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
import {CentralHeadingSearchClient,decodeHeadingDeltas,decodeBinaryHeadingDictionary,headingPhraseWordMatches} from './central_heading_search'
import {normalizeArabicSearch} from '../../packages/search/src/index'
// @ts-expect-error Offline artifact tooling is not shipped with the application.
import {encodeHeadingDictionary} from '../../tools/build-heading-dictionary-binary.mjs'
const root=resolve(process.cwd(),'artifacts/heading-search-sample-v1')
it('filters authenticated book ownership before fetching rows and keeps exact counts',async()=>{
 const old=await tinyFixture(true,100),fast=await tinyFixture(true,100)
 const ranges={manifestSha256:createHash('sha256').update(fast.files.get('manifest.json')!).digest('hex'),rowCount:100,ranges:[['1',0,2],['2',2,98]] as [string,number,number][]}
 const expected=await new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:old.fetch}).search('النسخ',{bookIds:['2'],limit:3})
 const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fast.fetch,bookRanges:ranges})
 const actual=await client.search('النسخ',{bookIds:['2'],limit:3})
 expect(actual).toEqual(expected);expect(actual.total).toBe(98);expect(actual.totalExact).toBe(true)
 expect(fast.ranges.length).toBeLessThanOrEqual(3);expect(old.ranges.length).toBe(100)
 expect((await client.search('النسخ',{bookIds:['2'],offset:97,limit:3})).hits.map(x=>x.rowId)).toEqual([99])
 expect((await client.search('النسخ',{bookIds:['missing']})).total).toBe(0)
 await expect(new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fast.fetch,bookRanges:{...ranges,manifestSha256:'0'.repeat(64)}}).search('النسخ')).rejects.toThrow('integrity')
})
it('page mode preserves filtered row order and exposes a lower bound instead of a false exact total',async()=>{
 const f=await tinyFixture(true,100),exact=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch}),paged=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch,countMode:'page'})
 const expected=await exact.search('النسخ',{bookIds:['2'],limit:100})
 const first=await paged.search('النسخ',{bookIds:['2'],limit:3})
 expect(first.hits).toEqual(expected.hits.slice(0,3));expect(first.totalExact).toBe(false);expect(first.total).toBeGreaterThan(3);expect(first.total).toBeLessThan(expected.total)
 const second=await paged.search('النسخ',{bookIds:['2'],offset:3,limit:3})
 expect(second.hits).toEqual(expected.hits.slice(3,6))
 const last=await paged.search('النسخ',{bookIds:['2'],offset:expected.total-2,limit:3})
 expect(last.totalExact).toBe(true);expect(last.total).toBe(expected.total);expect(last.hits).toEqual(expected.hits.slice(-2))
})
const fetcher:typeof fetch=async(input)=>{const path=new URL(String(input)).pathname.slice(1);try{return new Response(await readFile(resolve(root,path)))}catch{return new Response(null,{status:404})}}
it('matches all five reviewed queries and direct-scan identity hashes, paging and filters',async()=>{
 const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher}),audit=JSON.parse(await readFile(resolve(root,'audit.json'),'utf8'))
 for(const query of ['النسخ','النسخة','النسخ المعتمدة','النَّسخ','باب، النسخ']){
  const result=await client.search(query,{limit:100}),normalized=query==='النَّسخ'?'النسخ':query==='باب، النسخ'?'باب النسخ':query,reference=audit.audit.results.find((x:any)=>x.query===normalized)
  expect(result.total).toBe(reference.directCount);expect(result.coverageComplete).toBe(false)
  expect(createHash('sha256').update(result.hits.map(x=>x.rowId+'\n').join('')).digest('hex')).toBe(reference.directIdsSha256)
 }
 const all=await client.search('النسخ',{limit:100}),page=await client.search('النسخ',{offset:2,limit:3});expect(page.hits).toEqual(all.hits.slice(2,5));expect(page.total).toBe(all.total)
 const bookId=all.hits[0]!.bookId,filtered=await client.search('النسخ',{bookIds:[bookId],limit:100});expect(filtered.hits).toEqual(all.hits.filter(x=>x.bookId===bookId));expect(filtered.total).toBe(filtered.hits.length)
})
it('rejects corrupt bytes and pre-aborted searches without false empty success',async()=>{
 const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async(input,init)=>String(input).includes('dictionary/')?new Response(new Uint8Array([1])):fetcher(input,init)})
 await expect(client.search('النسخ')).rejects.toThrow('integrity')
 const signal=AbortSignal.abort();await expect(client.search('النسخ',{signal})).rejects.toThrow()
})
it('decodes reset-zero deltas and rejects truncated or non-increasing rows',()=>{
 expect(decodeHeadingDeltas(new Uint8Array([0,2,3]),3,10)).toEqual([0,2,5])
 for(const bytes of [[128],[1,0],[255,255,255,255,255,255,255,255]])expect(()=>decodeHeadingDeltas(new Uint8Array(bytes),2,10)).toThrow()
})
it('binds the reviewed normalizer to the current source implementation',async()=>{
 const source=await readFile(resolve(process.cwd(),'packages/search/src/index.ts')),manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'))
 expect(createHash('sha256').update(source).digest('hex')).toBe(manifest.normalizer.sourceSha256)
})
it('aborts an active fetch and frees the one-flight guard for a retry',async()=>{
 const controller=new AbortController();let started!:()=>void;const begun=new Promise<void>(resolve=>{started=resolve})
 const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async(_input,init)=>{started();return new Promise<Response>((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(init.signal?.reason),{once:true}))}})
 const pending=client.search('النسخ',{signal:controller.signal});await begun
 await expect(client.search('النسخ')).rejects.toThrow('busy');const assertion=expect(pending).rejects.toThrow();controller.abort();await assertion
 await expect(client.search('النسخ',{signal:AbortSignal.abort()})).rejects.not.toThrow('busy')
})
async function tinyFixture(v2=false,n=3){
 const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8')),files=new Map<string,Uint8Array>(),hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex')
 const asset=(folder:string,b:Uint8Array,ext:string)=>{const sha256=hash(b),path=`${folder}/${sha256}.${ext}`;files.set(path,b);return{path,sha256,bytes:b.length}}
 const posting=asset('postings',new Uint8Array(Array.from({length:n},(_,i)=>i?1:0)),'bin'),dictionaryBytes=Buffer.from(JSON.stringify([['النسخ',[[0,0,n,n]]]])),compressed=gzipSync(dictionaryBytes),dictionaryAsset=asset('dictionary',compressed,'json.gz')
 manifest.rowCount=n;manifest.bookCount=2;manifest.postings=[posting];manifest.rows=Array.from({length:n},(_,i)=>i===0?null:i===1?0:4).map((pageIndex,i)=>({...asset('rows',Buffer.from(JSON.stringify([[i>=2?'2':'1',String(i),null,'النسخ',pageIndex,'١','١',i,null]])),'json'),firstRow:i,count:1}));manifest.dictionary={path:dictionaryAsset.path,gzipBytes:compressed.length,gzipSha256:hash(compressed),bytes:dictionaryBytes.length,sha256:hash(dictionaryBytes),wordCount:1}
 if(v2){const pointers=Buffer.alloc(n*40);for(let i=0;i<n;i++){const body=files.get(manifest.rows[i].path)!,fragment=body.subarray(1,body.length-1);pointers.writeUInt32LE(1,i*40);pointers.writeUInt32LE(fragment.length,i*40+4);Buffer.from(hash(fragment),'hex').copy(pointers,i*40+8)}manifest.contract='khizana-heading-search/2';manifest.rowPointerEncoding='uint32le-offset,uint32le-length,sha256-32';manifest.rowPointers=[{...asset('pointers',pointers,'bin'),firstRow:0,count:n}]}
 files.set('manifest.json',Buffer.from(JSON.stringify(manifest)));const requests:string[]=[],ranges:string[]=[]
 const fetch:typeof globalThis.fetch=async(input,init)=>{const path=new URL(String(input)).pathname.slice(1);requests.push(path);const body=files.get(path),range=new Headers(init?.headers).get('range');if(range&&body){ranges.push(range);const [,start,end]=range.match(/^bytes=(\d+)-(\d+)$/)!;return new Response(body.slice(Number(start),Number(end)+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${body.length}`,'content-length':String(Number(end)-Number(start)+1)}})}return new Response(body??null,{status:body?200:404})}
 return{fetch,requests,ranges,files,manifest}
}
it('retains verified postings between searches without changing filtered and excluded results',async()=>{
 const f=await tinyFixture(true),client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch})
 const first=await client.search('النسخ');expect(await client.search('النسخ')).toEqual(first)
 expect((await client.search('النسخ',{bookIds:['2']})).total).toBe(1)
 expect((await client.search('النسخ',{excluded:['النسخ']})).total).toBe(0)
 expect(f.requests.filter(path=>path.startsWith('postings/'))).toHaveLength(1)
 await expect(client.search('النسخ',{signal:AbortSignal.abort()})).rejects.toThrow()
})
it('overlaps two required real posting shards without changing the exact total',async()=>{
 // @ts-expect-error Local artifact adapter is tooling, not application runtime.
 const {localHeadingFetch}=await import('../../tools/local-heading-server.mjs')
 const io=await localHeadingFetch('artifacts/heading-search-central-v2','artifacts/heading-dictionary-binary-v1'),release=JSON.parse(await readFile('artifacts/heading-search-central-v2/client-release.json','utf8'))
 let active=0,peak=0
 const client=new CentralHeadingSearchClient({baseURL:'https://heading.local/',dictionaryBinary:release.dictionaryBinary,planTokens:true,fetch:async(url,init)=>{if(!String(url).includes('/postings/'))return io.fetcher(url,init);active++;peak=Math.max(peak,active);try{await new Promise(ok=>setTimeout(ok,5));return await io.fetcher(url,init)}finally{active--}}})
 expect((await client.search('النسخ')).total).toBe(3849);expect(peak).toBe(2);expect(active).toBe(0)
},30000)
it('keeps the client busy until failed or aborted lookahead I/O actually settles, then permits retry',async()=>{
 // @ts-expect-error Local adapter is tooling only.
 const {localHeadingFetch}=await import('../../tools/local-heading-server.mjs')
 const release=JSON.parse(await readFile('artifacts/heading-search-central-v2/client-release.json','utf8'))
 for(const mode of ['corrupt','abort']){
  const io=await localHeadingFetch('artifacts/heading-search-central-v2','artifacts/heading-dictionary-binary-v1'),controller=new AbortController()
  let seen=0,broken=true,started!:()=>void,noticed!:()=>void,finish!:()=>void
  const both=new Promise<void>(ok=>{started=ok}),aborted=new Promise<void>(ok=>{noticed=ok})
  const client=new CentralHeadingSearchClient({baseURL:'https://heading.local/',dictionaryBinary:release.dictionaryBinary,planTokens:true,fetch:async(url,init)=>{
   if(!broken||!String(url).includes('/postings/'))return io.fetcher(url,init)
   if(++seen===1){await both;if(mode==='abort')controller.abort();return new Response(new Uint8Array([9]))}
   return new Promise<Response>((_ok,reject)=>{init?.signal?.addEventListener('abort',()=>{finish=()=>reject(init.signal?.reason);noticed()},{once:true});started()})
  }})
  const pending=client.search('النسخ',{signal:controller.signal}),rejected=expect(pending).rejects.toThrow()
  await aborted;await expect(client.search('النسخ')).rejects.toThrow('busy');finish();await rejected
  broken=false;expect((await client.search('النسخ')).total).toBe(3849)
 }
},30000)
it('plans normalized single-token exclusions before row retrieval and exact paging',async()=>{
 for(const excluded of [['النَّسخ'],['، النسخ!'],['-النسخ'],['(١) النسخ'],['معدومة']]){
  const f=await tinyFixture(true,12),client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch})
  const result=await client.search('النسخ',{excluded,limit:2})
  const removes=excluded[0]!=='معدومة';expect(result.total).toBe(removes?0:12)
  expect(result.hits).toHaveLength(removes?0:2)
  expect(f.requests.filter(path=>path.startsWith('rows/')).length).toBeLessThanOrEqual(2)
 }
})
it('narrows real phrase candidates at word boundaries without losing any of the 112 audited titles',async()=>{
 const base=resolve('artifacts/heading-search-central-v2'),release=JSON.parse(await readFile(resolve(base,'client-release.json'),'utf8')),audit=JSON.parse(await readFile(resolve('artifacts/heading-search-central-v1/audit.json'),'utf8')),old=JSON.parse(await readFile(resolve('artifacts/heading-search-central-v1/manifest.json'),'utf8')),manifest=JSON.parse(await readFile(resolve(base,'manifest.json'),'utf8'))
 expect(manifest.sourceRecordsSha256).toBe(old.sourceRecordsSha256)
 let rowRequests=0;const fetch:typeof globalThis.fetch=async(input,init)=>{const path=new URL(String(input)).pathname.slice(1),body=await readFile(resolve(path.endsWith('.compact.bin.gz')?'artifacts/heading-dictionary-binary-v1':base,path)),range=new Headers(init?.headers).get('range');if(!range)return new Response(body);rowRequests++;const [,a,b]=range.match(/^bytes=(\d+)-(\d+)$/)!;return new Response(body.subarray(Number(a),Number(b)+1),{status:206,headers:{'content-range':`bytes ${a}-${b}/${body.length}`,'content-length':String(Number(b)-Number(a)+1)}})}
 const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch,planTokens:true,dictionaryBinary:release.dictionaryBinary}),result=await client.search('النسخ المعتمدة',{limit:500}),reference=audit.audit.results.find((entry:any)=>entry.query==='النسخ المعتمدة')
 expect(result.total).toBe(112);expect(createHash('sha256').update(result.hits.map(hit=>hit.rowId+'\n').join('')).digest('hex')).toBe(reference.directIdsSha256)
 console.log(JSON.stringify({phraseRows:rowRequests,total:result.total}));expect(rowRequests).toBeLessThan(150)
},30000)
it('preserves every substring phrase boundary including repeated tokens and normalized punctuation',()=>{
 for(const title of ['والنسخ المعتمدة','النسخ النسخ','والنسخ المعتمدة في النسخة','باب، النَّسخ (١) المعتمدة','نسخ نسخة نسخ']){
  const normalized=normalizeArabicSearch(title),words=normalized.split(' ')
  for(let start=0;start<normalized.length;start++)for(let end=start+1;end<=normalized.length;end++){
   const query=normalized.slice(start,end).trim(),tokens=query.split(' ')
   expect(tokens.every((token,position)=>words.some(word=>headingPhraseWordMatches(word,token,position,tokens.length)))).toBe(true)
  }
 }
 expect(headingPhraseWordMatches('النسخة','النسخ',0,2)).toBe(false)
 expect(headingPhraseWordMatches('والمعتمدة','المعتمدة',1,2)).toBe(false)
 expect(headingPhraseWordMatches('والنسخ','النسخ',1,3)).toBe(false)
 expect(headingPhraseWordMatches('والنسخ','النسخ',0,2)).toBe(true)
 expect(headingPhraseWordMatches('المعتمدات','المعتمد',1,2)).toBe(true)
})
it('does not retain corrupt or aborted posting responses and keeps the query budget on cache hits',async()=>{
 for(const mode of ['corrupt','abort']){
  const f=await tinyFixture(true),controller=new AbortController();let broken=true
  const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async(input,init)=>{const response=await f.fetch(input,init);if(broken&&String(input).includes('/postings/')){if(mode==='abort')controller.abort();else return new Response(new Uint8Array([9,9,9]))}return response}})
  await expect(client.search('النسخ',{signal:controller.signal})).rejects.toThrow();broken=false
  expect((await client.search('النسخ')).total).toBe(3);expect(f.requests.filter(path=>path.startsWith('postings/'))).toHaveLength(2)
  // Configuration is deliberately tightened after a warm load to prove cache hits
  // cannot evade the same per-query working-set/transfer accounting.
  ;(client as any).options.maxQueryShardBytes=1
  await expect(client.search('النسخ')).rejects.toThrow('memory_budget')
 }
})
it('evicts least recently used verified posting bytes at eight MiB',async()=>{
 const payloads=new Map<string,Uint8Array>(),hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex'),assets=Array.from({length:9},(_,i)=>{const bytes=new Uint8Array(1048576).fill(i),sha256=hash(bytes),path=`postings/${sha256}.bin`;payloads.set(path,bytes);return{path,sha256,bytes:bytes.length}})
 let reads=0;const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async input=>{reads++;return new Response(payloads.get(new URL(String(input)).pathname.slice(1)))}})
 for(const asset of assets)await (client as any).postingBytes(asset)
 expect((client as any).postingCacheBytes).toBe(8*1048576);expect((client as any).postingCache.size).toBe(8)
 await (client as any).postingBytes(assets[8]);expect(reads).toBe(9)
 await (client as any).postingBytes(assets[0]);expect(reads).toBe(10);expect((client as any).postingCacheBytes).toBe(8*1048576)
})
it('reads a source-bound binary dictionary without fetching the JSON dictionary',async()=>{
 const f=await tinyFixture(true),hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex'),raw=encodeHeadingDictionary([['النسخ',[[0,0,3,3]]]]),gzip=gzipSync(raw),path=`dictionary/${hash(gzip)}.compact.bin.gz`
 const descriptor={encoding:'khizana-heading-dictionary-binary/1',path,bytes:raw.length,sha256:hash(raw),gzipBytes:gzip.length,gzipSha256:hash(gzip),wordCount:1,sourceDictionarySha256:f.manifest.dictionary.sha256,sourceManifestSha256:hash(f.files.get('manifest.json')!)};f.files.set(path,gzip)
 const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch,planTokens:true,dictionaryBinary:descriptor}),result=await client.search('النسخ');expect(result.total).toBe(3);expect(result.hits[0]?.pageIndex).toBeNull();expect(f.requests).not.toContain(f.manifest.dictionary.path)
 for(const override of [{sha256:'0'.repeat(64)},{sourceDictionarySha256:'0'.repeat(64)},{sourceManifestSha256:'0'.repeat(64)}])await expect(new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch,planTokens:true,dictionaryBinary:{...descriptor,...override}}).search('النسخ')).rejects.toThrow('integrity')
})
it('exports only an opaque completed dictionary and rejects forged, copied or differently bound handles',async()=>{
 const f=await tinyFixture(true),hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex'),raw=encodeHeadingDictionary([['النسخ',[[0,0,3,3]]]]),gzip=gzipSync(raw),path=`dictionary/${hash(gzip)}.compact.bin.gz`
 const descriptor={encoding:'khizana-heading-dictionary-binary/1',path,bytes:raw.length,sha256:hash(raw),gzipBytes:gzip.length,gzipSha256:hash(gzip),wordCount:1,sourceDictionarySha256:f.manifest.dictionary.sha256,sourceManifestSha256:hash(f.files.get('manifest.json')!)};f.files.set(path,gzip)
 const options={baseURL:'https://heading.test/',fetch:f.fetch,planTokens:true,dictionaryBinary:descriptor},a=new CentralHeadingSearchClient(options),handle=await a.createDictionarySnapshot()
 expect(Reflect.ownKeys(handle)).toEqual([]);expect(Object.isFrozen(handle)).toBe(true);expect(()=>Object.defineProperty(handle,'segments',{value:new Uint32Array()})).toThrow()
 expect(Reflect.ownKeys(a)).not.toContain('compact');expect(Reflect.ownKeys(a)).not.toContain('manifest')
 const before=f.requests.length,b=new CentralHeadingSearchClient({...options,dictionarySnapshot:handle});expect(await b.createDictionarySnapshot()).toBe(handle);expect(f.requests.length).toBe(before)
 expect((await b.search('النسخ')).total).toBe(3);expect((await a.search('النسخ')).total).toBe(3)
 for(const dictionarySnapshot of [{}, {...handle}])await expect(new CentralHeadingSearchClient({...options,dictionarySnapshot:dictionarySnapshot as typeof handle}).search('النسخ')).rejects.toThrow('snapshot_invalid')
 await expect(new CentralHeadingSearchClient({...options,maxDictionaryBytes:1,dictionarySnapshot:handle}).search('النسخ')).rejects.toThrow('snapshot_invalid')
 await expect(a.createDictionarySnapshot(AbortSignal.abort())).rejects.toThrow()
})
it('rejects malformed binary offsets, lengths and word counts before use',()=>{
 const raw=encodeHeadingDictionary([['النسخ',[[0,0,3,3]]]])
 expect(decodeBinaryHeadingDictionary(raw,1).words).toEqual(['النسخ'])
 for(const mutate of [(b:Buffer)=>b.writeUInt32LE(1,20),(b:Buffer)=>b.writeUInt32LE(99,16),(b:Buffer)=>b.writeUInt32LE(8,24)]){const bad=Buffer.from(raw);mutate(bad);expect(()=>decodeBinaryHeadingDictionary(bad,1)).toThrow()}
 expect(()=>decodeBinaryHeadingDictionary(raw,2)).toThrow()
})
it.runIf(Boolean(process.env.ALKHIZANA_HEADING_BINARY_AUDIT))('verifies every binary word and segment against the full source dictionary',async()=>{
 const source=resolve('artifacts/heading-search-central-v2'),binaryRoot=resolve('artifacts/heading-dictionary-binary-v1'),m=JSON.parse(await readFile(resolve(source,'manifest.json'),'utf8')),d=JSON.parse(await readFile(resolve(binaryRoot,'descriptor.json'),'utf8'))
 const gzip=await readFile(resolve(binaryRoot,d.path));expect(createHash('sha256').update(gzip).digest('hex')).toBe(d.gzipSha256);const raw=gunzipSync(gzip);expect(raw.length).toBe(d.bytes);expect(createHash('sha256').update(raw).digest('hex')).toBe(d.sha256)
 const decoded=decodeBinaryHeadingDictionary(raw,d.wordCount),original=JSON.parse(gunzipSync(await readFile(resolve(source,m.dictionary.path))).toString()),a=createHash('sha256'),b=createHash('sha256')
 for(let i=0;i<original.length;i++){a.update(JSON.stringify(original[i])+'\n');const segments=[];for(let at=decoded.offsets[i]!;at<decoded.offsets[i+1]!;at+=4)segments.push(Array.from(decoded.segments.subarray(at,at+4)));b.update(JSON.stringify([decoded.words[i],segments])+'\n')}
 expect(decoded.words.length).toBe(original.length);expect(b.digest('hex')).toBe(a.digest('hex'))
},30000)
it('shares one bounded range for adjacent rows while preserving each row SHA and budget',async()=>{
 const f=await tinyFixture(true),hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex')
 const fragments=f.manifest.rows.map((asset:any)=>f.files.get(asset.path)!.subarray(1,f.files.get(asset.path)!.length-1)),body=Buffer.concat(fragments),pointers=Buffer.alloc(120);let offset=0
 fragments.forEach((fragment:Uint8Array,i:number)=>{pointers.writeUInt32LE(offset,i*40);pointers.writeUInt32LE(fragment.length,i*40+4);Buffer.from(hash(fragment),'hex').copy(pointers,i*40+8);offset+=fragment.length})
 const rowPath=`rows/${hash(body)}.json`,pointerPath=`pointers/${hash(pointers)}.bin`
 f.files.set(rowPath,body);f.files.set(pointerPath,pointers)
 f.manifest.rows=[{path:rowPath,sha256:hash(body),bytes:body.length,firstRow:0,count:3}]
 f.manifest.rowPointers=[{path:pointerPath,sha256:hash(pointers),bytes:pointers.length,firstRow:0,count:3}]
 f.files.set('manifest.json',Buffer.from(JSON.stringify(f.manifest)))
 const result=await new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch}).search('النسخ')
 expect(result.hits.map(hit=>hit.pageIndex)).toEqual([null,0,4]);expect(result.total).toBe(3);expect(f.ranges).toEqual([`bytes=0-${body.length-1}`])
 await expect(new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch,maxQueryShardBytes:123}).search('النسخ')).rejects.toThrow('memory_budget')
 const corrupt=Buffer.from(body);corrupt[2]^=1;f.files.set(rowPath,corrupt)
 await expect(new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch}).search('النسخ')).rejects.toThrow('integrity')
})
it('retries one row transport interruption with the same range, never abort or invalid proof',async()=>{
 for(const stage of ['fetch','body']){
  const f=await tinyFixture(true),calls:{range:string;cache?:RequestCache}[]=[];let failed=false
  const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async(input,init)=>{
   const range=new Headers(init?.headers).get('range');if(!range)return f.fetch(input,init)
   calls.push({range,cache:init?.cache})
   if(!failed){failed=true;if(stage==='fetch')throw new TypeError('Failed to fetch');const good=await f.fetch(input,init);await good.body?.cancel();return new Response(new ReadableStream({start(c){c.error(new TypeError('Failed to fetch'))}}),{status:206,headers:good.headers})}
   return f.fetch(input,init)
  }})
  expect((await client.search('النسخ',{limit:1})).hits).toHaveLength(1)
  expect(calls).toHaveLength(2);expect(calls[1]!.range).toBe(calls[0]!.range);expect(calls[1]!.cache).toBe('reload')
 }
 const f=await tinyFixture(true);let attempts=0
 const alwaysFails=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async(input,init)=>{if(new Headers(init?.headers).has('range')){attempts++;throw new TypeError('Failed to fetch')}return f.fetch(input,init)}})
 await expect(alwaysFails.search('النسخ',{limit:1})).rejects.toThrow('Failed to fetch');expect(attempts).toBe(2)
 const controller=new AbortController();attempts=0
 const cancelled=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async(input,init)=>{if(new Headers(init?.headers).has('range')){attempts++;controller.abort();throw new TypeError('Failed to fetch')}return f.fetch(input,init)}})
 await expect(cancelled.search('النسخ',{limit:1,signal:controller.signal})).rejects.toThrow();expect(attempts).toBe(1)
})
it('reads /2 rows with exact ranges and row SHA, preserving the /1 results',async()=>{
 const a=await tinyFixture(),b=await tinyFixture(true),v1=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:a.fetch}),v2=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:b.fetch})
 expect(await v2.search('النسخ',{bookIds:['1']})).toEqual(await v1.search('النسخ',{bookIds:['1']}));expect(b.ranges).toHaveLength(3);expect(b.requests.filter(path=>path.startsWith('pointers/'))).toHaveLength(1)
 await v2.search('النسخ',{bookIds:['1']});expect(b.ranges).toHaveLength(3)
})
it('uses retained row cache entries even when an earlier page miss would evict them',async()=>{
 const f=await tinyFixture(true,8),client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch,maxRowCacheEntries:2,preserveCachedRows:true})
 const first=await client.search('النسخ',{bookIds:['1','2']});expect(f.ranges).toHaveLength(8)
 expect(await client.search('النسخ',{bookIds:['1','2']})).toEqual(first);expect(f.ranges).toHaveLength(14)
})
it('rejects ignored ranges, wrong content ranges and corrupt precise rows',async()=>{
 for(const mode of ['ignored','header','corrupt']){const f=await tinyFixture(true),client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async(input,init)=>{const response=await f.fetch(input,init);if(!new Headers(init?.headers).has('range'))return response;const body=new Uint8Array(await response.arrayBuffer());if(mode==='ignored')return new Response(body);if(mode==='corrupt')body[1]^=1;const headers=new Headers(response.headers);if(mode==='header')headers.set('content-range','bytes 0-1/2');return new Response(body,{status:206,headers})}});await expect(client.search('النسخ')).rejects.toThrow(mode==='corrupt'?'integrity':'range_unavailable')}
})
it('matches the independently built /2 sample for all five queries',async()=>{
 const fetch:typeof globalThis.fetch=async(input,init)=>{const path=new URL(String(input)).pathname.slice(1),body=await readFile(resolve(process.cwd(),'artifacts/heading-search-sample-v2',path)),range=new Headers(init?.headers).get('range');if(!range)return new Response(body);const [,a,b]=range.match(/^bytes=(\d+)-(\d+)$/)!;return new Response(body.subarray(Number(a),Number(b)+1),{status:206,headers:{'content-range':`bytes ${a}-${b}/${body.length}`,'content-length':String(Number(b)-Number(a)+1)}})}
 const v1=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher}),v2=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch})
 for(const q of ['النسخ','النسخة','النسخ المعتمدة','النَّسخ','باب، النسخ'])expect(await v2.search(q,{limit:100})).toEqual(await v1.search(q,{limit:100}))
})
it('permits an injected cooperative scheduler without changing results',async()=>{
 let yields=0;const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher,yieldControl:async()=>{yields++}}),standard=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher})
 expect(await client.search('النسخ المعتمدة')).toEqual(await standard.search('النسخ المعتمدة'));expect(yields).toBeGreaterThan(0)
})
it('reuses a bounded token plan without rescanning the dictionary for unions',async()=>{
 let metrics:Record<string,number>={};const optimized=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher,planTokens:true,yieldControl:async()=>{},onMetrics:m=>{metrics=m}}),normal=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher})
 for(const q of ['النسخ','النسخة','النسخ المعتمدة','باب النسخ'])expect(await optimized.search(q)).toEqual(await normal.search(q))
 expect(metrics.estimateDictionaryVisits).toBe(6070);expect(metrics.unionDictionaryVisits).toBeLessThan(6070)
})
it('compacts dictionary segment storage without changing titles, anchors or exact totals',async()=>{
 let metrics:Record<string,number>={};const compact=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher,planTokens:true,compactDictionary:true,yieldControl:async()=>{},onMetrics:m=>{metrics=m}}),normal=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher})
 expect(await compact.search('النسخ')).toEqual(await normal.search('النسخ'));expect(metrics.dictionaryCompactBytes).toBeGreaterThan(0)
 for(const q of ['النسخة','النسخ المعتمدة','باب النسخ'])expect(await compact.search(q,{limit:100})).toEqual(await normal.search(q,{limit:100}))
})
it('applies exclusions before exact totals and paging, including the single-token shortcut',async()=>{
 const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher}),all=await client.search('النسخ',{limit:100}),expected=all.hits.filter(hit=>!hit.title.includes('المعتمدة'))
 expect(expected.length).toBeLessThan(all.total)
 const result=await client.search('النسخ',{excluded:['المعتمدة'],offset:1,limit:2});expect(result.total).toBe(expected.length);expect(result.hits).toEqual(expected.slice(1,3))
 const f=await tinyFixture(true),binaryRows=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch});expect((await binaryRows.search('النسخ',{excluded:['النَّسخ'],limit:1})).total).toBe(0)
})
it('aborts during cooperative token estimation and enforces server deadlines',async()=>{
 const controller=new AbortController(),client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:fetcher,yieldControl:async()=>{controller.abort()}})
 await expect(client.search('النسخ',{signal:controller.signal})).rejects.toThrow()
 const deadline=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:async(_input,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(init.signal?.reason))),queryTimeoutMs:5})
 await expect(deadline.search('النسخ')).rejects.toThrow()
})
it('counts a single token exactly without fetching off-page row shards; preserves null and page zero',async()=>{
 const f=await tinyFixture(),client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch})
 const page=await client.search('النسخ',{limit:1});expect(page.total).toBe(3);expect(page.hits[0]?.pageIndex).toBeNull();expect(f.requests.filter(x=>x.startsWith('rows/'))).toHaveLength(1)
 const second=await client.search('النسخ',{offset:1,limit:1});expect(second.hits[0]?.pageIndex).toBe(0)
 const filtered=await client.search('النسخ',{bookIds:['2']});expect(filtered.total).toBe(1);expect(filtered.hits[0]?.bookId).toBe('2')
})
it('fails explicitly on candidate and shard budgets instead of truncating exact totals',async()=>{
 const f=await tinyFixture()
 for(const budget of [{maxCandidateEntries:2},{maxQueryShardBytes:1}])await expect(new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch:f.fetch,...budget}).search('النسخ')).rejects.toThrow('memory_budget')
})
it.runIf(Boolean(process.env.ALKHIZANA_FULL_HEADING_CLIENT_AUDIT))('measures full artifact request counts without enabling production',async()=>{
 const full=resolve(process.cwd(),process.env.ALKHIZANA_FULL_HEADING_CLIENT_ROOT??'artifacts/heading-search-central-v1'),requests:string[]=[];let bytes=0
 const fetch:typeof globalThis.fetch=async(input,init)=>{const path=new URL(String(input)).pathname.slice(1),body=await readFile(resolve(full,path)),range=new Headers(init?.headers).get('range');requests.push(path);if(range){const [,a,b]=range.match(/^bytes=(\d+)-(\d+)$/)!,part=body.subarray(Number(a),Number(b)+1);bytes+=part.length;return new Response(part,{status:206,headers:{'content-range':`bytes ${a}-${b}/${body.length}`,'content-length':String(part.length)}})}bytes+=body.length;return new Response(body)}
 const audit=JSON.parse(await readFile(resolve(process.cwd(),'artifacts/heading-search-central-v1/audit.json'),'utf8'))
 for(const query of ['النسخ','النسخة','النسخ المعتمدة','النَّسخ','باب، النسخ']){const client=new CentralHeadingSearchClient({baseURL:'https://heading.test/',fetch,...(process.env.ALKHIZANA_HEADING_OPTIMIZED?{planTokens:true,preserveCachedRows:true,compactDictionary:Boolean(process.env.ALKHIZANA_HEADING_COMPACT),yieldControl:()=>new Promise<void>(resolve=>setImmediate(resolve)),queryTimeoutMs:10000}:{})}),normalized=query==='النَّسخ'?'النسخ':query==='باب، النسخ'?'باب النسخ':query,reference=audit.audit.results.find((x:any)=>x.query===normalized)
  for(const phase of ['cold','warm']){const start=performance.now(),count=requests.length,before=bytes
   try{const page=await client.search(query,{limit:20});console.log('HEADING_CLIENT_FULL '+JSON.stringify({query,phase,ms:Math.round(performance.now()-start),requests:requests.length-count,bytes:bytes-before,total:page.total,hits:page.hits.length,coverage:page.coverageComplete,heapUsed:process.memoryUsage().heapUsed}));expect(page.totalExact).toBe(true);expect(page.total).toBe(reference.directCount)}catch(error){console.log('HEADING_CLIENT_FULL '+JSON.stringify({query,error:String(error),requests:requests.length-count,bytes:bytes-before}));throw error}
  }
  if(reference.directCount<=500){const all=await client.search(query,{limit:500});expect(createHash('sha256').update(all.hits.map(x=>x.rowId+'\n').join('')).digest('hex')).toBe(reference.directIdsSha256)}
 }
},180000)
