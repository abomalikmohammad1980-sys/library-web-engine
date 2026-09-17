import {loadAuthorOverride,saveAuthorOverride,type AuthorOverrideDraft} from './author_override_client'

/** Apply the submitted edits to a fresh cloud version, retaining untouched fields. */
export async function saveRebasedAuthorOverride(id:string,base:AuthorOverrideDraft,draft:AuthorOverrideDraft,options:{signal?:AbortSignal;canSave:()=>boolean;load?:typeof loadAuthorOverride;save?:typeof saveAuthorOverride}){
 const load=options.load??loadAuthorOverride,save=options.save??saveAuthorOverride
 for(let attempt=0;attempt<3;attempt++){
  options.signal?.throwIfAborted();if(!options.canSave())throw Error('super_admin_required')
  const requestOptions=options.signal?{signal:options.signal}:{}
  const latest=await load(id,requestOptions)
  if(!options.canSave())throw Error('super_admin_required')
  const rebased={...draft,expectedVersion:latest?.revision??0,fields:{}} as AuthorOverrideDraft
  for(const key of ['displayName','biography','source'] as const)if(draft[key]===base[key])rebased[key]=latest?.[key]??draft[key]
  for(const key of Object.keys(draft.fields??{})){
   const name=key as keyof NonNullable<AuthorOverrideDraft['fields']>
   if(JSON.stringify(draft.fields?.[name])!==JSON.stringify(base.fields?.[name]))Object.assign(rebased.fields!,{[name]:draft.fields![name]})
  }
  // A previous PATCH may have committed even when its response was lost or
  // reported a conflict. Confirm the public cloud values before writing again.
  if(latest&&(['displayName','biography','source'] as const).every(key=>latest[key]===rebased[key].trim())&&Object.entries(rebased.fields??{}).every(([key,value])=>JSON.stringify(latest.fields?.[key as keyof NonNullable<AuthorOverrideDraft['fields']>])===JSON.stringify(value)))return{draft:rebased,latest,revision:latest.revision}
  try{return{draft:rebased,latest,revision:await save(id,rebased,requestOptions)}}
  catch(error){if(!(error instanceof Error)||error.message!=='author_override_conflict'||attempt===2)throw error}
 }
 throw Error('author_override_conflict')
}
