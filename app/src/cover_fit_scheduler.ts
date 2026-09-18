/** Combine layout/font/mutation notifications without dropping later changes. */
export function coalesceCoverFit(requestFrame:(callback:()=>void)=>unknown,fit:()=>void):()=>void {
  let pending=false
  return ()=>{
    if(pending)return
    pending=true
    requestFrame(()=>{pending=false;fit()})
  }
}
