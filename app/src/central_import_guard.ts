import{currentAccountClaims}from'./account_authority'
import{currentLibraryIdentityScope,type StoredBook,type BookIntakeFields}from'./engine/library_store'
export interface CentralImportInput {localBookId:string;metadata:BookIntakeFields;files:File[];book:StoredBook}
export interface CentralImportSaveStrategy {save(input:CentralImportInput):Promise<{id:string}>}
export function captureCentralImportGuard():()=>void{
 const identity=currentAccountClaims(),scope=currentLibraryIdentityScope()
 const guard=()=>{const active=currentAccountClaims();if(!identity||!active||!['editor','super-admin'].includes(active.role)||active.subject!==identity.subject||active.sessionId!==identity.sessionId||currentLibraryIdentityScope()!==scope)throw Error('تغيّرت صلاحية أو جلسة الإضافة المركزية؛ افتحها من جديد قبل النشر.')}
 guard();return guard
}
