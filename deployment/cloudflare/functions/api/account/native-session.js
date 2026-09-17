import {json,publicClaims} from '../_account-contract.js'
import {nativeSessionAccount} from '../_native-auth.js'
import {isAccountBlocked} from '../_account-block.js'
import {accessSessionAccount} from '../_access-session.js'
import {withAccountCapabilities} from '../_account-capabilities.js'

// Public session inspection accepts only server-issued application cookies.
// Raw Access assertions and caller-provided identity claims are ignored here.
export async function onRequestGet(context){
  if(!context.env?.VISITORS_DB)return json({error:'accounts_unavailable'},503)
  const account=await nativeSessionAccount(context)||await accessSessionAccount(context)
  if(!account)return json({authenticated:false,accessConfigured:Boolean(context.env.ACCOUNT_ACCESS_DOMAIN&&context.env.ACCOUNT_ACCESS_AUD)},401)
  if(await isAccountBlocked(context,account.subject))return json({authenticated:false,error:'account_blocked'},403)
  return json({authenticated:true,claims:publicClaims(await withAccountCapabilities(context,account))})
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
