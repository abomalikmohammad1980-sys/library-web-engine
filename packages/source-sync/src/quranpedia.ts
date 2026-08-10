import { sha256Fingerprint } from "./fingerprint.js";

export const QURANPEDIA_API_BASE = "https://api.quranpedia.net/v1/";
export type QuranpediaMetadataKind = "mushafs"|"topics"|"reciters"|"surah-information"|"surah-tafsirs"|"surah-books";
export interface QuranpediaProvenance { provider:"Quranpedia"; sourceUrl:string; retrievedAt:string; etag:string|null; checksumSha256:string; byteLength:number; apiVersion:"v1" }
export interface QuranpediaDocument<T=unknown>{data:T;provenance:QuranpediaProvenance}
export interface QuranpediaClientPolicy{maxResponseBytes:number;maxRetries:number;baseBackoffMs:number;maxBackoffMs:number;requestTimeoutMs:number}
export class QuranpediaClient{
 constructor(private readonly fetchImpl:typeof fetch=fetch,private readonly policy:QuranpediaClientPolicy={maxResponseBytes:8*1024*1024,maxRetries:3,baseBackoffMs:250,maxBackoffMs:4000,requestTimeoutMs:15000},private readonly now=()=>new Date()){}
 metadata(kind:QuranpediaMetadataKind,id?:number,signal?:AbortSignal){const path=route(kind,id);return this.json(path,signal)}
 ayahs(mushafId:number,surahId:number,ayah?:number,signal?:AbortSignal){boundedId(mushafId);boundedSurah(surahId);if(ayah!==undefined)boundedId(ayah);return this.json(`mushafs/${mushafId}/${surahId}${ayah===undefined?"":`/${ayah}`}`,signal)}
 book(id:number,signal?:AbortSignal){boundedId(id);return this.json(`book/${id}`,signal)}
 private async json(path:string,signal?:AbortSignal):Promise<QuranpediaDocument>{
  const url=new URL(path,QURANPEDIA_API_BASE);if(url.origin!==new URL(QURANPEDIA_API_BASE).origin||!url.pathname.startsWith("/v1/"))throw Error("quranpedia_url_rejected");
  let response:Response|undefined;for(let attempt=0;attempt<=this.policy.maxRetries;attempt++){const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),this.policy.requestTimeoutMs),abort=()=>timeout.abort();signal?.addEventListener("abort",abort,{once:true});try{response=await this.fetchImpl(url,{headers:{accept:"application/json"},signal:timeout.signal,redirect:"error"});}catch(error){if(signal?.aborted)throw error;if(attempt===this.policy.maxRetries)throw error;}finally{clearTimeout(timer);signal?.removeEventListener("abort",abort)}if(response&&response.ok)break;if(response&&!retryable(response.status))throw Error(`quranpedia_http_${response.status}`);if(attempt===this.policy.maxRetries)throw Error(`quranpedia_http_${response?.status??0}`);await delay(backoff(response,attempt,this.policy),signal)}
  const bytes=await boundedBytes(response!,this.policy.maxResponseBytes);let data:unknown;try{data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}catch{throw Error("quranpedia_invalid_json")};const fp=await sha256Fingerprint(bytes);return{data,provenance:{provider:"Quranpedia",sourceUrl:url.href,retrievedAt:this.now().toISOString(),etag:response!.headers.get("etag"),checksumSha256:fp.hex,byteLength:bytes.byteLength,apiVersion:"v1"}}
 }
}
export interface QuranPackStorage{size(tempKey:string):Promise<number>;read(tempKey:string):Promise<Uint8Array>;append(tempKey:string,bytes:Uint8Array):Promise<void>;reset(tempKey:string):Promise<void>;commitAtomic(tempKey:string,finalKey:string,manifest:QuranPackManifest):Promise<void>}
export interface QuranPackManifest{provider:"Quranpedia";sourceUrl:string;retrievedAt:string;etag:string|null;checksumSha256:string;byteLength:number;version:string}
export async function downloadQuranpediaPack(input:{url:string;version:string;tempKey:string;finalKey:string;maxBytes:number;maxEntries:number;maxExpandedBytes:number;maxCompressionRatio:number;expectedSha256?:string;resumeEtag?:string;fetchImpl?:typeof fetch;storage:QuranPackStorage;signal?:AbortSignal;now?:()=>Date}):Promise<QuranPackManifest>{
 const url=new URL(input.url);
 if(url.protocol!=="https:"||url.hostname!=="api.quranpedia.net")throw Error("quranpedia_pack_origin_rejected");
 let offset=await input.storage.size(input.tempKey);
 if(offset>input.maxBytes){await input.storage.reset(input.tempKey);throw Error("quranpedia_pack_size_limit")}
 if(offset>0&&!input.resumeEtag){await input.storage.reset(input.tempKey);offset=0}
 const headers:Record<string,string>={accept:"application/zip"};
 if(offset>0){headers.range=`bytes=${offset}-`;headers["if-range"]=input.resumeEtag!}
 const response=await(input.fetchImpl??fetch)(url,{headers,signal:input.signal??null,redirect:"error"});
 if(offset===0&&response.status!==200)throw Error(`quranpedia_pack_http_${response.status}`);
 if(offset>0){
  const etag=response.headers.get("etag"),range=response.headers.get("content-range");
  if(response.status!==206||etag!==input.resumeEtag||!range||!new RegExp(`^bytes ${offset}-\\d+/\\d+$`).test(range)){await input.storage.reset(input.tempKey);throw Error("quranpedia_pack_resume_mismatch")}
 }
 const chunk=await boundedBytes(response,input.maxBytes-offset);
 try{await input.storage.append(input.tempKey,chunk)}catch(error){await input.storage.reset(input.tempKey);throw error}
 const total=offset+chunk.byteLength;
 if(total>input.maxBytes)throw Error("quranpedia_pack_size_limit");
 let bytes:Uint8Array,fp:{hex:string};
 try{
  bytes=await collectForVerification(input.storage,input.tempKey,total);
  validatePackZip(bytes,input);
  fp=await sha256Fingerprint(bytes);
  if(input.expectedSha256&&fp.hex!==input.expectedSha256)throw Error("quranpedia_pack_checksum_mismatch");
 }catch(error){await input.storage.reset(input.tempKey);throw error}
 const manifest={provider:"Quranpedia"as const,sourceUrl:url.href,retrievedAt:(input.now??(()=>new Date()))().toISOString(),etag:response.headers.get("etag"),checksumSha256:fp.hex,byteLength:total,version:input.version};
 await input.storage.commitAtomic(input.tempKey,input.finalKey,manifest);
 return manifest;
}
async function collectForVerification(storage:QuranPackStorage,key:string,total:number){const bytes=await storage.read(key);if(bytes.byteLength!==total)throw Error("quranpedia_pack_incomplete");return bytes}
function validatePackZip(bytes:Uint8Array,p:{maxEntries:number;maxExpandedBytes:number;maxCompressionRatio:number}){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let e=-1;for(let o=v.byteLength-22;o>=Math.max(0,v.byteLength-65557);o--)if(v.getUint32(o,true)===0x06054b50){e=o;break}if(e<0||e+22>v.byteLength)throw Error("quranpedia_pack_invalid_zip");const count=v.getUint16(e+10,true),size=v.getUint32(e+12,true),start=v.getUint32(e+16,true);if(count>p.maxEntries||start+size!==e)throw Error("quranpedia_pack_invalid_zip");let o=start,total=0;for(let i=0;i<count;i++){if(o+46>e||v.getUint32(o,true)!==0x02014b50)throw Error("quranpedia_pack_invalid_zip");const flags=v.getUint16(o+8,true),compressed=v.getUint32(o+20,true),raw=v.getUint32(o+24,true),nl=v.getUint16(o+28,true),xl=v.getUint16(o+30,true),cl=v.getUint16(o+32,true);if(flags&1)throw Error("quranpedia_pack_encrypted");const name=new TextDecoder().decode(bytes.subarray(o+46,o+46+nl));if(!name||name.includes("\\")||name.startsWith("/")||name.split("/").includes(".."))throw Error("quranpedia_pack_unsafe_path");total+=raw;if(total>p.maxExpandedBytes||raw>0&&(compressed===0||raw/compressed>p.maxCompressionRatio))throw Error("quranpedia_pack_expansion_limit");o+=46+nl+xl+cl}if(o!==e)throw Error("quranpedia_pack_invalid_zip")}
async function boundedBytes(r:Response,max:number){const declared=Number(r.headers.get("content-length"));if(Number.isFinite(declared)&&declared>max)throw Error("quranpedia_response_size_limit");const reader=r.body?.getReader();if(!reader)return new Uint8Array(await r.arrayBuffer());const parts:Uint8Array[]=[];let total=0;for(;;){const{x,done}=await reader.read().then(({value,done})=>({x:value,done}));if(done)break;if(x){total+=x.byteLength;if(total>max){await reader.cancel();throw Error("quranpedia_response_size_limit")}parts.push(x)}}const out=new Uint8Array(total);let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out}
function route(k:QuranpediaMetadataKind,id?:number){if(k==="mushafs"||k==="topics"||k==="reciters"){if(id!==undefined)throw Error("quranpedia_id_not_allowed");return k}boundedSurah(id);return `${k==="surah-information"?"surah/information":k==="surah-tafsirs"?"surah/tafsirs":"surah/books"}/${id}`}
function boundedId(n:number|undefined){if(!Number.isSafeInteger(n)||n!<1)throw Error("quranpedia_invalid_id")}function boundedSurah(n:number|undefined){boundedId(n);if(n!>114)throw Error("quranpedia_invalid_surah")}
function retryable(s:number){return s===408||s===429||s>=500}function backoff(r:Response|undefined,a:number,p:QuranpediaClientPolicy){const h=Number(r?.headers.get("retry-after"));return Math.min(p.maxBackoffMs,Number.isFinite(h)&&h>=0?h*1000:p.baseBackoffMs*2**a)}function delay(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{const t=setTimeout(resolve,ms);signal?.addEventListener("abort",()=>{clearTimeout(t);reject(new DOMException("Aborted","AbortError"))},{once:true})})}
