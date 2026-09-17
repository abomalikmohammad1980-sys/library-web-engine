// Keep the UI responsive without paying a clamped timer for every 4096 words.
// Callers still check cancellation at every block boundary.
export function createHeadingScanCheckpoint(
 now:()=>number=()=>performance.now(),
 yieldTask:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,0)),
):()=>Promise<void>{
 let resumedAt=now()
 return async()=>{
  if(now()-resumedAt<8)return
  await yieldTask()
  resumedAt=now()
 }
}
