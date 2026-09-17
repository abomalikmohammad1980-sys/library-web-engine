import {currentAccountClaims} from './account_authority'
import {currentLibraryIdentityScope} from './engine/library_store'

/** Review dialogs belong to the identity that opened them, including guests. */
export function captureLocalImportGuard():()=>void{
 const identity=currentAccountClaims(),scope=currentLibraryIdentityScope()
 return ()=>{
  const active=currentAccountClaims()
  if(currentLibraryIdentityScope()!==scope||active?.subject!==identity?.subject||active?.sessionId!==identity?.sessionId)
   throw Error('تغيّر الحساب أو جلسة الاستيراد؛ افتح إضافة الكتب من جديد.')
 }
}
