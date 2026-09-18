// A negative membership test only. Positive candidates still use original text.
export function positionBits(id:string,position:number,bitCount:number):number[]{
 const key=id+':'+position;let a=2166136261,b=0x9e3779b9
 for(let i=0;i<key.length;i++){a=Math.imul(a^key.charCodeAt(i),16777619);b=Math.imul(b^key.charCodeAt(i),0x85ebca6b);b^=b>>>13}
 a>>>=0;b=(b|1)>>>0
 return Array.from({length:10},(_,i)=>((a+Math.imul(i,b))>>>0)%bitCount)
}
export function addPosition(bytes:Uint8Array,id:string,position:number){for(const bit of positionBits(id,position,bytes.length*8))bytes[bit>>>3]!|=1<<(bit&7)}
export function mayContainPosition(bytes:Uint8Array,id:string,position:number){return position>=0&&positionBits(id,position,bytes.length*8).every(bit=>(bytes[bit>>>3]!&(1<<(bit&7)))!==0)}
type Filter={word:string;releaseId:string;sourceManifestSha256:string;termSha256:string;sha256:string;byteLength:number;parts:Array<{url:string;sha256:string;byteLength:number}>}
const hash=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
export class SearchPositionFilters{
 private cache=new Map<string,Promise<Uint8Array>>()
 async get(config:unknown,word:string,releaseId:string,manifestSha:string,termSha:string,fetcher:typeof fetch,digest:(b:Uint8Array)=>Promise<string>,onBytes:(n:number)=>void){
  if(config===undefined)return undefined
  if(!Array.isArray(config)||config.length>16)throw Error('position_filter_config')
  const matches=config.filter(f=>f?.word===word)
  if(!matches.length)return undefined
  if(matches.length!==1)throw Error('position_filter_duplicate')
  const f=matches[0] as Filter
  if(f.releaseId!==releaseId||f.sourceManifestSha256!==manifestSha||f.termSha256!==termSha)throw Error('position_filter_source_mismatch')
  if(!hash(f.sha256)||!Number.isSafeInteger(f.byteLength)||f.byteLength<1||f.byteLength>16*1024*1024||!Array.isArray(f.parts)||!f.parts.length||f.parts.length>16||f.parts.some(p=>!hash(p.sha256)||!Number.isSafeInteger(p.byteLength)||p.byteLength<1||p.byteLength>1024*1024||typeof p.url!=='string'||!/^https:\/\//.test(p.url))||f.parts.reduce((n,p)=>n+p.byteLength,0)!==f.byteLength)throw Error('position_filter_descriptor')
  let task=this.cache.get(f.sha256)
  if(!task){task=(async()=>{
   const out=new Uint8Array(f.byteLength);let cursor=0
   // Four in flight; each immutable chunk is independently verified.
   for(let i=0;i<f.parts.length;i+=4){const pieces=await Promise.all(f.parts.slice(i,i+4).map(async p=>{
    const r=await fetcher(p.url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('position_filter_http')
    const reader=r.body?.getReader();if(!reader)throw Error('position_filter_body');const bytes=new Uint8Array(p.byteLength);let count=0
    try{for(;;){const v=await reader.read();if(v.done)break;if(count+v.value.length>bytes.length)throw Error('position_filter_length');bytes.set(v.value,count);count+=v.value.length}}finally{await reader.cancel()}
    onBytes(count);if(count!==p.byteLength||await digest(bytes)!==p.sha256)throw Error('position_filter_integrity');return bytes
   }));for(const bytes of pieces){out.set(bytes,cursor);cursor+=bytes.length}}
   if(await digest(out)!==f.sha256)throw Error('position_filter_integrity');return out
  })();this.cache.set(f.sha256,task);task.catch(()=>this.cache.delete(f.sha256))}
  return task
 }
}
