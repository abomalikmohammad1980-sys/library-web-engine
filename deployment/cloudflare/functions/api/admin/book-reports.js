import {trustedAccount,isManager,json} from '../_account-contract.js'
export async function onRequestGet(context){
 if(!isManager(await trustedAccount(context)))return json({error:'admin_required'},403)
 const url=new URL(context.request.url),owner=url.searchParams.get('owner')??'',page=Number(url.searchParams.get('page')??0)
 if(owner.length>240||!Number.isSafeInteger(page)||page<0||page>10000)return json({error:'invalid_page'},400)
 try{const result=await context.env.VISITORS_DB.prepare("SELECT id,book_id AS bookId,book_title AS bookTitle,kind,message,context_json AS contextJson,status,created_at AS createdAt FROM book_reader_reports WHERE reporter_subject=? ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET ?").bind(owner,page*30).all();return json({reports:(result.results??[]).slice(0,30).map(({contextJson,...r})=>({...r,context:JSON.parse(contextJson??'{}')})),hasMore:(result.results??[]).length>30,page})}catch{return json({error:'reports_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
