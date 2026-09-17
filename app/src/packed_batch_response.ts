import type {GroupPart} from './packed_range_groups'
/** Experimental transport boundary. No endpoint is enabled by this module. */
export async function verifiedPackedBatch(response:Response,parts:readonly GroupPart[],sha:(bytes:Uint8Array)=>Promise<string>,signal?:AbortSignal):Promise<Uint8Array[]>{
 const total=parts.reduce((sum,part)=>sum+part.length,0)
 if(!parts.length||parts.length>16||!Number.isSafeInteger(total)||total>1024*1024||parts.some(part=>!Number.isSafeInteger(part.length)||part.length<1||!/^[a-f0-9]{64}$/.test(part.sha256))){await response.body?.cancel();throw Error('packed_batch_bounds')}
 if(response.status!==200||!response.body){await response.body?.cancel();throw Error('packed_batch_unavailable')}
 const reader=response.body.getReader(),bytes=new Uint8Array(total);let received=0
 const abort=()=>{void reader.cancel().catch(()=>undefined)}
 signal?.addEventListener('abort',abort,{once:true})
 try{
  signal?.throwIfAborted()
  for(;;){const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;if(received+value.length>total)throw Error('packed_batch_length');bytes.set(value,received);received+=value.length}
  if(received!==total)throw Error('packed_batch_length')
  const slices:Uint8Array[]=[];let offset=0
  for(const part of parts){signal?.throwIfAborted();const slice=bytes.slice(offset,offset+part.length);if(await sha(slice)!==part.sha256)throw Error('packed_batch_corrupt');slices.push(slice);offset+=part.length}
  signal?.throwIfAborted();return slices
 }finally{signal?.removeEventListener('abort',abort);await reader.cancel();reader.releaseLock()}
}
