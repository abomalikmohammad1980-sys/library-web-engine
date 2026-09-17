export function backgroundDataRouteAllowed(hash:string):boolean {
 return hash===''||/^#\/(?:home|library)?(?:\?|$)/u.test(hash)
}
export function createBackgroundDataScheduler(options:{canRun:()=>boolean;idle:(callback:()=>void)=>unknown;run:()=>Promise<void>;onError?:(error:unknown)=>void}){
 let pending=false,running=false,complete=false
 return {notify(){
  if(pending||running||complete||!options.canRun())return
  pending=true
  options.idle(()=>{
   pending=false
   if(running||complete||!options.canRun())return
   running=true
   void Promise.resolve().then(options.run).then(()=>{complete=true}).catch(error=>options.onError?.(error)).finally(()=>{running=false})
  })
 }}
}
