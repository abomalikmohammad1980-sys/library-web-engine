import {currentLibraryIdentityScope,listBooks} from './engine/library_store'
import {inferBookFormat} from './book_format'

/** Serial, local-only warmup. Never download the public corpus at startup. */
export function installBackgroundSearchIndex():()=>void{
 const attempted=new Set<string>()
 const failures=new Map<string,number>()
 let timer:ReturnType<typeof setTimeout>|undefined,running=false,again=false,disposed=false
 let controller:AbortController|undefined
 const schedule=()=>{
  if(disposed)return
  if(running){again=true;return}
  if(timer!==undefined)clearTimeout(timer)
  timer=setTimeout(()=>{timer=undefined;void scan()},3000)
 }
 const scan=async()=>{
  if(disposed)return
  running=true;controller=new AbortController()
  const signal=controller.signal,identity=currentLibraryIdentityScope()
  try{
   const books=await listBooks()
   for(const book of books){
    if(disposed||signal.aborted||currentLibraryIdentityScope()!==identity)break
    // Remote placeholders are handled by server indexing or demand repair.
    if(!book.data?.length||book.sourceKind==='shamela4.1')continue
    const key=JSON.stringify([identity,book.id,book.originalSha256,book.textToc,book.bokToc])
    if(attempted.has(key)||(failures.get(key)??0)>=3)continue
    try{
     // Keep parser/search chunks off the startup path, including libraries
     // containing only remote placeholders. Listeners are installed immediately.
     const {headingIndex}=await import('./engine/heading_index')
     if(disposed||signal.aborted||currentLibraryIdentityScope()!==identity)break
     const headings=await headingIndex(book)
     if(signal.aborted||currentLibraryIdentityScope()!==identity)break
     if(inferBookFormat(book)!=='pdf'){
      const {prepareLocalBookSearchIndex}=await import('./engine/search_store')
      if(disposed||signal.aborted||currentLibraryIdentityScope()!==identity)break
      await prepareLocalBookSearchIndex(book.id,{signal})
     }
     // Parsers may return incomplete instead of throwing on a transient failure.
     // Never stamp that revision as ready merely because body indexing succeeded.
     if(!headings.complete)throw Error('heading_index_incomplete')
     if(!signal.aborted&&currentLibraryIdentityScope()===identity){attempted.add(key);failures.delete(key)}
    }catch{
     // A failed attempt is not an indexed revision. Retry transient failures
     // automatically, but bound retries for corrupt or missing source files.
     if(!signal.aborted&&currentLibraryIdentityScope()===identity){const count=(failures.get(key)??0)+1;failures.set(key,count);if(count<3)again=true}
    }
    // Yield between books to keep input/navigation responsive.
    await new Promise<void>(resolve=>setTimeout(resolve,50))
   }
  }catch{/* Offline/catalog failures are retried on the next library change. */}
  finally{running=false;controller=undefined;if(again){again=false;schedule()}}
 }
 const identityChanged=()=>{controller?.abort();attempted.clear();failures.clear();schedule()}
 const online=()=>{failures.clear();schedule()}
 window.addEventListener('library-changed',schedule)
 window.addEventListener('alkhizana:account-changed',identityChanged)
 window.addEventListener('online',online)
 schedule()
 return ()=>{disposed=true;controller?.abort();if(timer!==undefined)clearTimeout(timer);window.removeEventListener('library-changed',schedule);window.removeEventListener('alkhizana:account-changed',identityChanged);window.removeEventListener('online',online)}
}
