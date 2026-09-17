/** Only browsing routes can reload automatically; reading/editing stays uninterrupted. */
export function serviceWorkerRefreshRoute(hash:string):boolean{
 const path=hash.replace(/^#/,'').split('?')[0]||'/'
 return ['/', '/search','/library','/authors','/sunnah'].includes(path)
}

/** User-edited controls stay protected until the owning screen removes them. */
export function createServiceWorkerInteractionGuard(){
 const edited=new WeakSet<Element>()
 const controls='input,textarea,select,[contenteditable]:not([contenteditable="false"])'
 return{
  edited(target:EventTarget|null){if(target instanceof Element){const control=target.closest(controls);if(control)edited.add(control)}},
  safe(doc:Document,hash:string){
   if(!serviceWorkerRefreshRoute(hash)||doc.visibilityState!=='visible')return false
   if(doc.querySelector('dialog[open],[role="dialog"],[data-bok-unsaved="true"],[aria-busy="true"]'))return false
   if(doc.activeElement?.closest(controls))return false
   if(doc.getSelection()?.toString())return false
   return ![...doc.querySelectorAll(controls)].some(node=>edited.has(node))
  },
 }
}

/** Navigation/visibility events share a single, rate-limited update check. */
export function createServiceWorkerUpdateCheck(update:()=>Promise<boolean>,now=()=>Date.now(),interval=60_000){
 let last=-Infinity,inflight:Promise<boolean>|undefined
 return(force=false):Promise<boolean>=>{
  if(inflight)return inflight
  if(!force&&now()-last<interval)return Promise.resolve(false)
  last=now()
  inflight=Promise.resolve().then(update).catch(()=>false).finally(()=>{inflight=undefined})
  return inflight
 }
}
