import type {GroupPart} from './packed_range_groups'
interface Pending {part:GroupPart;resolve:(bytes:Uint8Array)=>void;reject:(error:unknown)=>void}
/** Experimental bounded queue. transport must verify every returned part. */
export class PackedBatchQueue {
 private pending:Pending[]=[]
 private scheduled=false
 private active=0
 private controller=new AbortController()
 private running=new Set<Pending[]>()
 constructor(private readonly transport:(parts:GroupPart[],signal:AbortSignal)=>Promise<Uint8Array[]>,private readonly collectMs=0){
  if(!Number.isInteger(collectMs)||collectMs<0||collectMs>16)throw Error('packed_batch_collect_bounds')
 }
 dispose(){
  if(this.controller.signal.aborted)return
  this.controller.abort(new Error('packed_batch_disposed'))
  for(const item of this.pending.splice(0))item.reject(this.controller.signal.reason)
  for(const batch of this.running)for(const item of batch)item.reject(this.controller.signal.reason)
  this.running.clear()
 }
 read(part:GroupPart):Promise<Uint8Array>{
  if(this.controller.signal.aborted)return Promise.reject(this.controller.signal.reason)
  if(!Number.isSafeInteger(part.length)||part.length<1||part.length>1024*1024)return Promise.reject(Error('packed_batch_part_bounds'))
  if(this.pending.length>=1024)return Promise.reject(Error('packed_batch_queue_full'))
  return new Promise((resolve,reject)=>{this.pending.push({part,resolve,reject});this.schedule()})
 }
 private schedule(){if(this.scheduled)return;this.scheduled=true;setTimeout(()=>{this.scheduled=false;this.drain()},this.collectMs)}
 private drain(){
  while(!this.controller.signal.aborted&&this.active<2&&this.pending.length){
   const batch:Pending[]=[];let bytes=0
   while(this.pending.length&&batch.length<16&&bytes+this.pending[0]!.part.length<=1024*1024){const item=this.pending.shift()!;bytes+=item.part.length;batch.push(item)}
   this.active++
   this.running.add(batch)
   void Promise.resolve().then(()=>{this.controller.signal.throwIfAborted();return this.transport(batch.map(item=>item.part),this.controller.signal)}).then(parts=>{
    this.controller.signal.throwIfAborted()
    if(parts.length!==batch.length||parts.some((part,index)=>part.length!==batch[index]!.part.length))throw Error('packed_batch_result_bounds')
    parts.forEach((part,index)=>batch[index]!.resolve(part))
   }).catch(error=>{batch.forEach(item=>item.reject(error))}).finally(()=>{this.running.delete(batch);this.active--;if(this.collectMs&&this.pending.length)this.schedule();else this.drain()})
  }
 }
}
