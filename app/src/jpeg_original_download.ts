import {h} from './ui'
import {downloadBytes,currentLibraryIdentityScope,type StoredBook} from './engine/library_store'
import {localOriginalAsset} from './library_card_state'
import {captureRouteResourceScope} from './resource_lifecycle'

/** Keep duplicate names and page order; each download is an explicit user gesture. */
export function downloadJpegOriginal(book:StoredBook):void{
 const sources=book.volumes?.length?[...book.volumes].sort((a,b)=>a.number-b.number):[book]
 const assets=sources.map(source=>localOriginalAsset(source))
 if(assets.some(asset=>!asset))throw Error('jpeg_original_missing')
 if(assets.length===1){const asset=assets[0]!;downloadBytes(asset.bytes,asset.fileName,'image/jpeg');return}
 const scope=currentLibraryIdentityScope()
 const dialog=h('dialog',{'aria-label':'تحميل صور الكتاب الأصلية',dir:'rtl',style:'max-width:min(32rem,90vw);max-height:80vh;border:1px solid #9aaa9c;border-radius:16px;padding:20px'}) as HTMLDialogElement
 const close=h('button',{type:'button',class:'btn btn--secondary'},'إغلاق')
 close.addEventListener('click',()=>dialog.close())
 dialog.append(h('h3',null,'تحميل صور JPG الأصلية'),close)
 for(const [index,asset] of assets.entries()){
  const button=h('button',{type:'button',class:'btn btn--secondary',style:'display:block;max-width:100%;overflow-wrap:anywhere;margin-block:8px'},`${index+1} — ${asset!.fileName}`)
  button.addEventListener('click',()=>{if(currentLibraryIdentityScope()!==scope){dialog.close();return}downloadBytes(asset!.bytes,asset!.fileName,'image/jpeg')})
  dialog.append(button)
 }
 dialog.addEventListener('close',()=>dialog.remove(),{once:true})
 captureRouteResourceScope().add(()=>{dialog.close();dialog.remove()})
 document.body.append(dialog);dialog.showModal()
}
