/** Bounds the complete biography model; never substitutes an older snapshot. */
export function createPeopleLoadGate(scope:{disposed:boolean;add:(cleanup:()=>void)=>unknown}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('people_load_timeout')),30_000)
 controller.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true})
 scope.add(()=>controller.abort(Error('people_route_cancelled')))
 return{signal:controller.signal,active:()=>!scope.disposed&&!controller.signal.aborted,finish:()=>clearTimeout(timer),wait:<T>(work:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{
  const signal=controller.signal,abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason)}
  signal.addEventListener('abort',abort,{once:true})
  work.then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(signal.reason);else resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(error)})
  if(signal.aborted||scope.disposed)abort()
 })}
}
