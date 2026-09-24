import {h} from './ui'
import {icon} from './icons'
import {captureRouteResourceScope} from './resource_lifecycle'
import {currentAccountClaims} from './account_authority'
import {localOriginalAsset} from './library_card_state'
import {collectionVisibilityUrl,readCollectionVisibility} from './collection_visibility'
export type CollectionBookRef={id:string;title:string}

export function collectionDownloadButton(title:()=>string,books:(signal:AbortSignal)=>Promise<readonly CollectionBookRef[]>):HTMLButtonElement{
 const scope=captureRouteResourceScope()
 const button=h('button',{type:'button',class:'btn btn--secondary collection-download',title:'تحميل القسم كاملا','aria-label':'تحميل القسم كاملا'},icon('download',20))
 button.onclick=async()=>{
  if(button.disabled||scope.disposed)return
  button.disabled=true
  const session=currentAccountClaims()?.sessionId
  let isCurrent=()=>!scope.disposed&&currentAccountClaims()?.sessionId===session
  try{
   const [{openCollectionDownload},{describePublicOriginalDownloads},{currentLibraryIdentityScope,getBook}]=await Promise.all([import('./collection_download_dialog'),import('./public_book_resolver'),import('./engine/library_store')])
   if(!isCurrent())return
   const identity=currentLibraryIdentityScope()
   isCurrent=()=>!scope.disposed&&currentLibraryIdentityScope()===identity&&currentAccountClaims()?.sessionId===session
   openCollectionDownload({title:title(),books,isCurrent,remote:(id,signal)=>describePublicOriginalDownloads(id,{signal}),resolve:async(id,signal)=>{
    if(signal.aborted||!isCurrent())throw new DOMException('Cancelled','AbortError')
    const book=await getBook(id)
    if(!book)return undefined
    if(book.managedSource==='published'){
     // Most catalog BOK records contain reading JSON, not a downloadable BOK.
     // Avoid downloading or preparing these texts just to report the missing original.
     if(!localOriginalAsset(book))return undefined
     const visibilitySignal=AbortSignal.any([signal,AbortSignal.timeout(10000)])
     const response=await fetch(collectionVisibilityUrl(book),{credentials:'omit',cache:'no-store',redirect:'error',signal:visibilitySignal})
     const overrides=await readCollectionVisibility(response,visibilitySignal)
     const row=overrides.find(row=>row.bookId===id||row.bookId===book.sourceBookId)
     if(row?(row.logicallyDeleted||row.visibility!=='public'):(book.logicallyDeletedAt||book.visibility&&book.visibility!=='public'))return undefined
    }
    if(signal.aborted||!isCurrent())throw new DOMException('Cancelled','AbortError')
    return book
   }})
  }catch{if(isCurrent()){button.title='تعذّر فتح التنزيل؛ أعد المحاولة';button.setAttribute('aria-label',button.title)}}
  finally{if(!scope.disposed)button.disabled=false}
 }
 return button
}
