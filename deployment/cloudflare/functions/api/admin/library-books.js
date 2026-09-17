import {createBookSubmission} from '../account/books.js'
import {json,trustedAccount,canEditLibrary} from '../_account-contract.js'
// Mutation preconditions must never come from the cacheable public overlay.
export async function onRequestGet(context){
 const account=await trustedAccount(context)
 if(!canEditLibrary(account))return json({error:'editor_required'},403)
 const result=await context.env.VISITORS_DB.prepare('SELECT book_id AS bookId,revision FROM central_book_overrides').all()
 return json({overrides:(result.results??[]).map(row=>({bookId:row.bookId,revision:Number(row.revision??0)}))})
}
export const onRequestPost=context=>createBookSubmission(context,{publishNew:true})
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET, POST'})
