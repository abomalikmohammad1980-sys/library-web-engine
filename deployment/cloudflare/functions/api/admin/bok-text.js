import {json,trustedAccount,trustedMutation,canEditLibrary} from '../_account-contract.js'
import {validDraftKey,validDraftWrite,readDraft,saveDraft,boundedDraftBody} from '../_bok-text-drafts.js'
export async function onRequest(context){
 const {request,env}=context
 if(!['GET','PUT'].includes(request.method))return json({error:'method_not_allowed'},405,{allow:'GET, PUT'})
 if(request.method==='PUT'&&!trustedMutation(request))return json({error:'cross_site_request_rejected'},403)
 const account=await trustedAccount(context);if(!canEditLibrary(account))return json({error:'editor_required'},403)
 if(env.BOK_TEXT_EDITING_ENABLED!=='1')return json({error:'bok_editor_not_ready'},503)
 const params=new URL(request.url).searchParams,bookId=params.get('bookId'),sourceHash=params.get('sourceHash'),raw=params.get('pageId'),pageId=raw&&/^\d+$/.test(raw)?Number(raw):NaN
 if([...params.keys()].some(k=>!['bookId','sourceHash','pageId'].includes(k)||params.getAll(k).length!==1)||!validDraftKey(bookId,sourceHash,pageId))return json({error:'invalid_bok_page'},400)
 if(request.method==='GET')return json({draft:await readDraft(env.VISITORS_DB,bookId,sourceHash,pageId)})
 const body=await boundedDraftBody(request);if(!validDraftWrite(body))return json({error:'invalid_bok_draft'},400)
 const draft=await saveDraft(env.VISITORS_DB,{bookId,sourceHash,pageId},body,account.subject)
 return draft?json({draft}):json({error:'bok_draft_conflict'},409)
}
