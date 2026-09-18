// Biography and Sunnah search routes need their own data/language first;
// opening a book loads the reader. Do not compete with cold search setup.
// The landing page must not download the entire reader without reading intent.
const readerWarmRoutes=new Set(['new-books','browse','library','shelves','editions','series','data-quality'])
export const readerPrewarmRouteEligible=(route:string):boolean=>readerWarmRoutes.has(route)
/** Recheck navigation/visibility when idle work actually runs, not when queued. */
export function createReaderIdlePrewarm(eligible:()=>boolean,load:()=>Promise<unknown>,enqueue:(callback:()=>void)=>void):()=>void{
 let pending=false,loaded=false
 return ()=>{
  if(pending||loaded||!eligible())return
  pending=true
  try{enqueue(()=>{
   if(!eligible()){pending=false;return}
   void Promise.resolve().then(load).then(()=>{loaded=true}).catch(()=>undefined).finally(()=>{pending=false})
  })}catch{pending=false}
 }
}
