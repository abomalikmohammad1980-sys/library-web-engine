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

/** User input in the import dialog takes precedence over speculative work. */
export function backgroundDataInteractionAllowed(doc:Pick<Document,'querySelector'>=document):boolean{return !doc.querySelector?.('.quick-book-import[open], .word-upload-setup')}

/** Catalog consumers may proceed once pairing ends, including the import itself. */
export function catalogDataInteractionAllowed():boolean {
 return typeof document==='undefined'||!document.querySelector?.('.word-upload-setup, .quick-book-import[open][data-import-preparing]')
}

/** Recheck async continuations without polling; abort releases route-owned waiters. */
export function waitForBackgroundDataInteraction(options:{canRun?:()=>boolean;events?:EventTarget;signal?:AbortSignal}={}):Promise<boolean>{
 const canRun=options.canRun??(()=>typeof document==='undefined'||backgroundDataInteractionAllowed())
 if(options.signal?.aborted)return Promise.resolve(false)
 if(canRun())return Promise.resolve(true)
 const events=options.events??window
 return new Promise(resolve=>{
  const finish=(ready:boolean)=>{events.removeEventListener('alkhizana:import-activity',check);options.signal?.removeEventListener('abort',abort);resolve(ready)}
  const check=()=>{if(canRun())finish(true)}
  const abort=()=>finish(false)
  events.addEventListener('alkhizana:import-activity',check)
  options.signal?.addEventListener('abort',abort,{once:true})
  if(options.signal?.aborted)abort();else check()
 })
}
