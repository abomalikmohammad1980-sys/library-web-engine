import {gunzipSync} from 'fflate'
type Pin={manifestUrl:string;manifestSha256:string}
type Part=readonly ['title'|'body'|'foot',number,number,string]
type BookRef={bookId:string;indexFile:string;indexBytes:number;indexSha256:string;expandedBytes:number;sourcePath:string;sourceBytes:number;sourceBookSha256:string;documents:number}
const hash=/^[a-f0-9]{64}$/u
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer)),x=>x.toString(16).padStart(2,'0')).join('')
async function readVerified(response:Response,pin:string,limit:number,exact?:number){
 if(!response.ok||!response.body||!hash.test(pin)||limit>32*1024*1024)throw Error('field_raw_response')
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit){await reader.cancel();throw Error('field_raw_size')}chunks.push(next.value)}}finally{reader.releaseLock()}
 if(exact!==undefined&&size!==exact)throw Error('field_raw_size')
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
 if(await digest(bytes)!==pin)throw Error('field_raw_checksum')
 return bytes
}
const json=(bytes:Uint8Array)=>JSON.parse(new TextDecoder().decode(bytes))
/** Original source string ranges only: no whole-book download or clipped text. */
export async function loadFieldRawRows(pin:Pin,overlaySha256:string,expectedBooks:number,expectedDocuments:number,fetcher:typeof fetch){
 const base=new URL(pin.manifestUrl)
 if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||!hash.test(pin.manifestSha256))throw Error('field_raw_pin')
 const get=(url:string,headers?:HeadersInit)=>fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000),...(headers?{headers}:{})})
 const manifest=json(await readVerified(await get(base.href),pin.manifestSha256,8*1024*1024))
 if(manifest.contract!=='khizana-field-source-ranges/1'||manifest.overlaySha256!==overlaySha256||manifest.complete!==true||manifest.counts?.books!==expectedBooks||manifest.counts?.documents!==expectedDocuments||!Array.isArray(manifest.books)||manifest.books.length!==expectedBooks)throw Error('field_raw_coverage')
 const books=new Map<string,BookRef>();let documents=0
 for(const entry of manifest.books as BookRef[]){
  if(!/^\d+$/u.test(entry.bookId)||books.has(entry.bookId)||entry.indexFile!==`books/${entry.bookId}.json.gz`||!new RegExp(`^/library/shamela/batches/batch-\\d{4}/books/${entry.bookId}\\.json$`).test(entry.sourcePath)||!hash.test(entry.indexSha256)||!hash.test(entry.sourceBookSha256)||![entry.indexBytes,entry.expandedBytes,entry.sourceBytes,entry.documents].every(n=>Number.isSafeInteger(n)&&n>0)||entry.indexBytes>32*1024*1024||entry.expandedBytes>32*1024*1024)throw Error('field_raw_book')
  books.set(entry.bookId,entry);documents+=entry.documents
 }
 if(documents!==expectedDocuments)throw Error('field_raw_coverage')
 const cache=new Map<string,Map<string,Part[]>>()
 return {async row(id:string,scope:'body'|'foot'){
  if(!/^\d+:\d+$/u.test(id))throw Error('field_raw_id')
  const bookId=id.split(':')[0]!,ref=books.get(bookId);if(!ref)throw Error('field_raw_book_missing')
  let rows=cache.get(bookId)
  if(!rows){
   const compressed=await readVerified(await get(new URL(ref.indexFile,base).href),ref.indexSha256,ref.indexBytes,ref.indexBytes)
   const expanded=gunzipSync(compressed);if(expanded.length!==ref.expandedBytes)throw Error('field_raw_expanded_size')
   const index=json(expanded)
   if(index.contract!=='khizana-field-source-ranges-book/1'||index.overlaySha256!==overlaySha256||index.bookId!==bookId||index.sourcePath!==ref.sourcePath||index.sourceBytes!==ref.sourceBytes||index.sourceBookSha256!==ref.sourceBookSha256||!Array.isArray(index.rows)||index.rows.length!==ref.documents)throw Error('field_raw_index')
   rows=new Map()
   for(const row of index.rows){
    if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||!row[0].startsWith(bookId+':')||!/^\d+:\d+$/u.test(row[0])||rows.has(row[0])||!Array.isArray(row[1])||!row[1].length)throw Error('field_raw_index_row')
    let previous=0;const seen=new Set<string>()
    for(const part of row[1]){
     if(!Array.isArray(part))throw Error('field_raw_part');const field=['title','body','foot'].indexOf(part[0])
     if(part.length!==4||field<previous||field<0||(field>0&&seen.has(part[0]))||!Number.isSafeInteger(part[1])||part[1]<0||!Number.isSafeInteger(part[2])||part[2]<2||part[2]>32*1024*1024||part[1]+part[2]>ref.sourceBytes||!hash.test(part[3]))throw Error('field_raw_part')
     previous=field;seen.add(part[0])
    }
    rows.set(row[0],row[1])
   }
   while(cache.size>=2)cache.delete(cache.keys().next().value!)
   cache.set(bookId,rows)
  }
  const parts=rows.get(id);if(!parts)throw Error('field_raw_row_missing')
  let fullText='',range:readonly [number,number]|undefined
  for(const [field,start,length,pin] of parts){
   const end=start+length-1,response=await get(new URL(ref.sourcePath,base).href,{Range:`bytes=${start}-${end}`})
   if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${end}/${ref.sourceBytes}`){await response.body?.cancel();throw Error('field_raw_range_required')}
   const text=json(await readVerified(response,pin,length,length));if(typeof text!=='string')throw Error('field_raw_string')
   if(fullText)fullText+='\n\n';const begin=fullText.length;fullText+=text
   if(field===scope)range=[begin,fullText.length]
  }
  if(!range)throw Error('field_raw_source_range')
  return {fullText,range}
 }}
}
