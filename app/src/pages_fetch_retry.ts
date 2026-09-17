/** Retry transient transport/server failures only, never a corrupt or missing asset. */
export function withPagesFetchRetry(fetcher:typeof fetch):typeof fetch{
 return (async(input:RequestInfo|URL,init?:RequestInit)=>{
  for(let attempt=0;;attempt++){
   const controller=new AbortController(),abort=()=>controller.abort(init?.signal?.reason)
   init?.signal?.addEventListener('abort',abort,{once:true});if(init?.signal?.aborted)abort()
   const timeout=setTimeout(()=>controller.abort(),20000)
   try{
    const response=await fetcher(input,{...init,signal:controller.signal})
    if(attempt===0&&[408,429,500,502,503,504].includes(response.status)){await response.body?.cancel();continue}
    return response
   }catch(error){if(attempt>0||init?.signal?.aborted)throw error}
   finally{clearTimeout(timeout);init?.signal?.removeEventListener('abort',abort)}
  }
 }) as typeof fetch
}
