/** Query-owned, bounded required postings only. No cross-query pending I/O. */
export class HeadingPostingLookahead{
 private readonly controller=new AbortController()
 private readonly signal:AbortSignal
 private readonly tasks=new Map<number,Promise<Uint8Array>>()
 constructor(private readonly cache:Map<number,Uint8Array>,private readonly reserve:(index:number)=>void,private readonly load:(index:number,signal:AbortSignal)=>Promise<Uint8Array>,signal?:AbortSignal,private readonly maxInflight=2){if(!Number.isInteger(maxInflight)||maxInflight<1||maxInflight>6)throw Error('heading_search_lookahead_limit');this.signal=signal?AbortSignal.any([signal,this.controller.signal]):this.controller.signal}
 private start(index:number){
  this.signal.throwIfAborted();if(this.cache.has(index)||this.tasks.has(index))return
  if(this.tasks.size>=this.maxInflight)throw Error('heading_search_lookahead_limit')
  this.reserve(index)
  const task=this.load(index,this.signal);this.tasks.set(index,task);void task.catch(()=>{})
 }
 async read(index:number,next?:number|readonly number[]){
  this.start(index);for(const required of typeof next==='number'?[next]:next??[])if(required!==index)this.start(required)
  const cached=this.cache.get(index);if(cached)return cached
  const bytes=await this.tasks.get(index)!;this.tasks.delete(index);this.signal.throwIfAborted()
  this.cache.set(index,bytes);while(this.cache.size>2)this.cache.delete(this.cache.keys().next().value!)
  return bytes
 }
 async close(){this.controller.abort();await Promise.allSettled([...this.tasks.values()]);this.tasks.clear()}
}
