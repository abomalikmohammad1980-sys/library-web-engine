/** Two independent range reads at most; preserve manifest order for full SHA. */
export async function loadPackedParts<P,T>(parts:readonly P[],load:(part:P)=>Promise<T>):Promise<T[]>{
 const values=new Array<T>(parts.length);let cursor=0,failed=false,error:unknown
 await Promise.all(Array.from({length:Math.min(2,parts.length)},async()=>{
  while(!failed&&cursor<parts.length){const index=cursor++
   try{values[index]=await load(parts[index]!)}catch(reason){if(!failed){failed=true;error=reason}}
  }
 }))
 if(failed)throw error
 return values
}
