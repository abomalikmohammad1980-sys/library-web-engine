/** Unwired provider. Descriptor must be authenticated by application release config. */
export interface FieldBoundaryIdentity { packedReleaseId:string; packedManifestSha256:string; policy:string; normalizerSha256:string }
export interface BoundaryAsset { path:string; byteLength:number; sha256:string }
export interface FieldBoundaryDescriptor extends FieldBoundaryIdentity { contract:string; complete:boolean; counts:{segments:number;books:number;documents:number;emptyDocuments:number}; indexBucketCount:number; indexFiles:Array<BoundaryAsset & {id:string}> }
type Part = BoundaryAsset & {firstSequence:number;lastSequence:number};
export type FieldBoundaryRow = [string,number,number,number];
const SHA=/^[a-f0-9]{64}$/, CAP=512*1024, TARGET=256*1024;
const fail=(code:string):never=>{throw Error(`field_boundary_${code}`)};
const num=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0;
const hash=async(b:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(b).buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');
/** Half-open token positions: phrase must fit wholly inside its selected field. */
export function phraseWithinField(row:FieldBoundaryRow,start:number,length:number,scope:'body'|'foot'):boolean {
 if(!num(start)||!num(length)||!length||!Number.isSafeInteger(start+length))return false;
 const low=scope==='body'?row[1]:row[2],high=scope==='body'?row[2]:row[3];return start>=low&&start+length<=high;
}
interface Flight {controller:AbortController;users:number;settled:boolean;promise:Promise<unknown>}
export class SearchFieldBoundaryProvider {
 private descriptor:FieldBoundaryDescriptor;private base:string;private fetcher:typeof fetch;
 private cache=new Map<string,{value:unknown;bytes:number}>();private cacheBytes=0;private flights=new Map<string,Flight>();private closed=false;
 constructor(options:{descriptor:FieldBoundaryDescriptor;expected:FieldBoundaryIdentity;baseUrl:string;fetch?:typeof fetch}) {
  this.descriptor=JSON.parse(JSON.stringify(options.descriptor));const d=this.descriptor;
  if(!d||d.contract!=='khizana-search-field-boundaries/1'||d.complete!==true||d.policy!=='positions+death-2'||!SHA.test(d.packedManifestSha256)||!SHA.test(d.normalizerSha256)||!d.packedReleaseId||(['packedReleaseId','packedManifestSha256','policy','normalizerSha256'] as const).some(k=>d[k]!==options.expected[k]))fail('descriptor');
  if(d.counts?.segments!==860||d.counts.books!==8594||d.counts.documents!==7626594||d.counts.emptyDocuments!==3||d.indexBucketCount!==256||!Array.isArray(d.indexFiles)||d.indexFiles.length!==256)fail('coverage');
  d.indexFiles.forEach((a,i)=>{const id=i.toString(16).padStart(2,'0');if(a.id!==id||a.path!==`indexes/${id}.json`)fail('index_path');this.asset(a)});
  const url=new URL(options.baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)fail('base');this.base=options.baseUrl.replace(/\/$/,'');this.fetcher=options.fetch??fetch;
 }
 private asset(a:BoundaryAsset){if(!a||!num(a.byteLength)||a.byteLength<1||a.byteLength>TARGET||!SHA.test(a.sha256))fail('asset')}
 private identity(v:any){for(const k of ['packedReleaseId','packedManifestSha256','policy','normalizerSha256'] as const)if(v?.[k]!==this.descriptor[k])fail('identity')}
 dispose(){this.closed=true;for(const f of this.flights.values())f.controller.abort();this.cache.clear();this.cacheBytes=0}
 private check(signal?:AbortSignal){if(this.closed)fail('disposed');signal?.throwIfAborted()}
 async lookup(docId:string,scope:'both'|'body'|'foot',signal?:AbortSignal):Promise<FieldBoundaryRow|undefined>{
  this.check(signal);if(scope==='both')return undefined;if(scope!=='body'&&scope!=='foot')fail('scope');
  if(!/^(0|[1-9]\d*):(0|[1-9]\d*)$/.test(docId))fail('docid');const [book,sequenceText]=docId.split(':') as [string,string];const sequence=Number(sequenceText);if(!num(sequence))fail('docid');
  const bucket=(await hash(new TextEncoder().encode(book))).slice(0,2);this.check(signal);const asset=this.descriptor.indexFiles[parseInt(bucket,16)]!;
  const index=await this.read(asset,v=>this.index(v,bucket),signal);const parts=index.get(book);if(!parts)fail('missing_book');
  const part=parts!.find(p=>sequence>=p.firstSequence&&sequence<=p.lastSequence);if(!part)fail('missing_document');
  const rows=await this.read(part!,v=>this.part(v,book,part!),signal);this.check(signal);const row=rows.find(r=>r[0]===docId);if(!row)fail('missing_document');return [...row!] as FieldBoundaryRow;
 }
 private async index(v:any,bucket:string):Promise<Map<string,Part[]>> {
  this.identity(v);if(v.contract!=='khizana-search-field-boundary-index/1'||!Array.isArray(v.entries))fail('index_schema');const result=new Map<string,Part[]>();
  for(const entry of v.entries){if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||!/^(0|[1-9]\d*)$/.test(entry[0])||result.has(entry[0])||!Array.isArray(entry[1]))fail('index_schema');const book=entry[0];if((await hash(new TextEncoder().encode(book))).slice(0,2)!==bucket)fail('book_bucket');let last=-1;
   const parts:Part[]=entry[1].map((p:Part,i:number)=>{this.asset(p);if(p.path!==`books/${book}/${String(i).padStart(4,'0')}.json`||!num(p.firstSequence)||!num(p.lastSequence)||p.firstSequence>p.lastSequence||p.firstSequence<=last)fail('part_ref');last=p.lastSequence;return p});result.set(book,parts);
  }return result;
 }
 private part(v:any,book:string,ref:Part):FieldBoundaryRow[]{
  if(v?.contract!=='khizana-search-field-boundary-part/1'||v.packedReleaseId!==this.descriptor.packedReleaseId||v.bookId!==book||!Array.isArray(v.rows)||!v.rows.length)fail('part_schema');let previous=-1;
  for(const row of v.rows){if(!Array.isArray(row)||row.length!==4||typeof row[0]!=='string'||!row[0].startsWith(`${book}:`)||!/^(0|[1-9]\d*)$/.test(row[0].slice(book.length+1))||!num(row[1])||!num(row[2])||!num(row[3])||row[1]>row[2]||row[2]>row[3])fail('row');const n=Number(row[0].slice(book.length+1));if(!num(n)||n<=previous||n<ref.firstSequence||n>ref.lastSequence)fail('sequence');previous=n;}
  if(v.rows[0][0]!==`${book}:${ref.firstSequence}`||previous!==ref.lastSequence)fail('sequence');return v.rows;
 }
 private async read<T>(a:BoundaryAsset,validate:(v:any)=>T|Promise<T>,signal?:AbortSignal):Promise<T>{
  this.check(signal);const key=`${a.path}:${a.sha256}`,cached=this.cache.get(key);if(cached){this.cache.delete(key);this.cache.set(key,cached);return cached.value as T}
  let f=this.flights.get(key);if(f?.controller.signal.aborted){this.flights.delete(key);f=undefined}
  if(!f){if(this.flights.size>=8)fail('busy');const controller=new AbortController(),active:Flight={controller,users:0,settled:false,promise:Promise.resolve()};
   active.promise=this.download(a,controller,validate).then(value=>{this.check(controller.signal);while(this.cache.size>=32||this.cacheBytes+a.byteLength>4*1024*1024){const k=this.cache.keys().next().value!;this.cacheBytes-=this.cache.get(k)!.bytes;this.cache.delete(k)}this.cache.set(key,{value,bytes:a.byteLength});this.cacheBytes+=a.byteLength;return value}).finally(()=>{active.settled=true;if(this.flights.get(key)===active)this.flights.delete(key)});this.flights.set(key,active);f=active;
  }const active=f;active.users++;return new Promise<T>((resolve,reject)=>{let done=false;const finish=(e:unknown,v?:unknown)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);active.users--;if(!active.users&&!active.settled)active.controller.abort();if(e)reject(e);else resolve(v as T)};const abort=()=>finish(signal?.reason??new DOMException('Aborted','AbortError'));signal?.addEventListener('abort',abort,{once:true});active.promise.then(v=>finish(null,v),e=>finish(e));if(signal?.aborted)abort()});
 }
 private async download<T>(a:BoundaryAsset,c:AbortController,validate:(v:any)=>T|Promise<T>):Promise<T>{
  const timer=setTimeout(()=>c.abort(Error('field_boundary_timeout')),8000),signal=c.signal;let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;const abort=()=>{void reader?.cancel(signal.reason).catch(()=>{})};signal.addEventListener('abort',abort,{once:true});
  try{const response=await this.fetcher(`${this.base}/${a.path}`,{signal,credentials:'omit',redirect:'error',cache:'force-cache'});signal.throwIfAborted();if(response.status!==200||!response.body)fail('http');reader=response.body!.getReader();const chunks:Uint8Array[]=[];let bytes=0;
   for(;;){const {value,done}=await reader.read();signal.throwIfAborted();if(done)break;bytes+=value.length;if(bytes>a.byteLength||bytes>CAP)fail('size');chunks.push(value)}if(bytes!==a.byteLength)fail('size');const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}if(await hash(body)!==a.sha256)fail('integrity');signal.throwIfAborted();const value=await validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body)));signal.throwIfAborted();return value;
  }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);await reader?.cancel().catch(()=>{});reader?.releaseLock()}
 }
}
