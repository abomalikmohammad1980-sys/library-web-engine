import {currentAccountClaims} from './account_authority'

/** Local data partition only; neither authentication nor cloud synchronization. */
export function readingStorageKey(legacyKey:string,subject:string|null=currentAccountClaims()?.subject??null):string{
  // Existing unscoped data belongs to the guest. Never silently adopt it on login.
  return subject===null?legacyKey:`alkhizana:account-data:v1:${JSON.stringify(subject)}:${legacyKey}`
}

/** Bind asynchronous reader callbacks to the identity that created them. */
export function captureReadingIdentity(){
  const subject=currentAccountClaims()?.subject??null
  const isCurrent=()=>subject===(currentAccountClaims()?.subject??null)
  return {
    isCurrent,
    key:(legacyKey:string)=>readingStorageKey(legacyKey,subject),
    getItem:(legacyKey:string)=>isCurrent()?localStorage.getItem(readingStorageKey(legacyKey,subject)):null,
    setItem:(legacyKey:string,value:string):boolean=>{if(!isCurrent())return false;localStorage.setItem(readingStorageKey(legacyKey,subject),value);return true},
  }
}
