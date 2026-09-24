/** A partially cached non-final page must be completed before navigation. */
export function searchPageReady(page:number,size:number,loaded:number,more:boolean):boolean{
 return loaded>page*size&&(!more||loaded>=(page+1)*size)
}
export async function completeSearchPage(page:number,size:number,state:()=>{loaded:number;more:boolean;current:boolean},fetchBatch:()=>Promise<void>):Promise<boolean>{
 while(true){const s=state();if(!s.current)return false;if(searchPageReady(page,size,s.loaded,s.more))return true;if(!s.more)return false;await fetchBatch()}
}

/** Fetch a small independent window concurrently, but expose only its
 * contiguous successful prefix. A failed page must not skip an offset. */
export async function fetchOrderedSearchWindow<T>(offsets:readonly number[],fetchBatch:(offset:number)=>Promise<T>,commit:(offset:number,value:T)=>void):Promise<void>{
 const settled=await Promise.allSettled(offsets.map(fetchBatch))
 for(let index=0;index<offsets.length;index++){
  const result=settled[index]!
  if(result.status==='rejected')throw result.reason
  commit(offsets[index]!,result.value)
 }
}
