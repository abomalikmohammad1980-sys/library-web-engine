import {currentAccountClaims} from './account_authority'
import {resolvePublicBookOriginal,type PublicBookResolverOptions} from './public_book_resolver'

/** Reuse byte/proof validation, but never use the anonymous publication endpoint. */
export async function resolveAccountBookOriginal(id:string,options:PublicBookResolverOptions={}){
 const identity=currentAccountClaims()
 const check=()=>{const active=currentAccountClaims();if(!identity||!active||identity.subject!==active.subject||identity.sessionId!==active.sessionId)throw Error('account_session_changed')}
 check()
 const source=await resolvePublicBookOriginal(id,{...options,fetch:async(input,init)=>{
  check()
  const path=input===`/api/library/published-books?id=${encodeURIComponent(id)}`?`/api/account/books/${encodeURIComponent(id)}/metadata`:input
  const response=await (options.fetch??fetch)(path,{...init,credentials:'same-origin',cache:'no-store'})
  try{check()}catch(error){await response.body?.cancel();throw error}
  return response
 }})
 check();return {...source,identity:`account-book:${id}`}
}
