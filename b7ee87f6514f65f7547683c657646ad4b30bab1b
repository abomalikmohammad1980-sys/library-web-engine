import {currentLibraryIdentityScope,listBooks} from './engine/library_store'
import {headingIndex} from './engine/heading_index'
import {inferBookFormat} from './book_format'
import {prepareLocalBookSearchIndex} from './engine/search_store'

/** Serial, local-only warmup. Never download the public corpus at startup. */
export function installBackgroundSearchIndex():()=>void{
 const attempted=new Set<string>()
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
    if(attempted.has(key))continue
    attempted.add(key)
    try{
     await headingIndex(book)
     if(signal.aborted||currentLibraryIdentityScope()!==identity)break
     if(inferBookFormat(book)!=='pdf')await prepareLocalBookSearchIndex(book.id,{signal})
    }catch{/* Preserve coverage failures; retry only after source change or explicit repair. */}
    // Yield between books to keep input/navigation responsive.
    await new Promise<void>(resolve=>setTimeout(resolve,50))
   }
  }catch{/* Offline/catalog failures are retried on the next library change. */}
  finally{running=false;controller=undefined;if(again){again=false;schedule()}}
 }
 const identityChanged=()=>{controller?.abort();attempted.clear();schedule()}
 window.addEventListener('library-changed',schedule)
 window.addEventListener('alkhizana:account-changed',identityChanged)
 schedule()
 return ()=>{disposed=true;controller?.abort();if(timer!==undefined)clearTimeout(timer);window.removeEventListener('library-changed',schedule);window.removeEventListener('alkhizana:account-changed',identityChanged)}
}
