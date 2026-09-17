/** Rows are visited in ascending order. Keep the furthest two pointer shards,
 * not the last two network completions: a slow old response must not evict
 * a newer shard that the next rows still need. Pending callers own their bytes.
 */
export class HeadingPointerCache<T>{
 private readonly entries=new Map<string,{firstRow:number;value:T}>()
 get(path:string){return this.entries.get(path)?.value}
 set(path:string,firstRow:number,value:T){
  this.entries.set(path,{firstRow,value})
  if(this.entries.size>2){
   let oldest:string|undefined,lowest=Infinity
   for(const [key,entry]of this.entries)if(entry.firstRow<lowest){lowest=entry.firstRow;oldest=key}
   this.entries.delete(oldest!)
  }
 }
}

/** Ordered, bounded read-ahead; never leave query I/O behind on error/stop. */
export async function visitHeadingRows<T>(ids:readonly number[],concurrency:number,read:(id:number)=>Promise<T>,consume:(id:number,value:T)=>void,stop:()=>boolean,signal?:AbortSignal):Promise<number>{
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>16)throw Error('heading_search_invalid_budget')
 const pending=new Map<number,Promise<T>>();let next=0,processed=0
 const fill=()=>{while(next<ids.length&&pending.size<concurrency){signal?.throwIfAborted();const index=next++,task=Promise.resolve().then(()=>read(ids[index]!));pending.set(index,task);void task.catch(()=>{})}}
 try{
  fill()
  for(let index=0;index<ids.length;index++){
   signal?.throwIfAborted();const value=await pending.get(index)!
   pending.delete(index);signal?.throwIfAborted();consume(ids[index]!,value);processed++
   if(stop())break
   fill()
  }
  return processed
 }finally{await Promise.allSettled(pending.values());pending.clear()}
}
