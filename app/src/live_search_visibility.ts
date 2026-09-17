let pending:Promise<ReadonlySet<string>>|undefined,expires=0
export function invalidateLiveSearchVisibility(){pending=undefined;expires=0}
export function loadLiveSearchHiddenBooks(fetcher:typeof fetch=(input,init)=>fetch(input,init)):Promise<ReadonlySet<string>>{
 if(pending&&Date.now()<expires)return pending
 expires=Date.now()+30000
 const task=(async()=>{
  const response=await fetcher('./api/library/central-overrides',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)})
  if(!response.ok)throw Error('live_visibility_unavailable')
  const payload=await response.json()
  if(payload?.schemaVersion!==1||!Array.isArray(payload.overrides))throw Error('live_visibility_invalid')
  const hidden=new Set<string>()
  for(const row of payload.overrides){
   if(!row||typeof row.bookId!=='string'||!['public','hidden','unlisted'].includes(row.visibility)||typeof row.logicallyDeleted!=='boolean')throw Error('live_visibility_invalid')
   if(row.visibility!=='public'||row.logicallyDeleted)hidden.add(row.bookId)
  }
  return hidden
 })()
 pending=task
 void task.catch(()=>{if(pending===task)invalidateLiveSearchVisibility()})
 return task
}
