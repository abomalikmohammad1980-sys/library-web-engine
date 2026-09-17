import {json,publicClaims,trustedAccount} from '../_account-contract.js'
import {registerDevice} from '../_account-device.js'
export async function onRequestGet(context){
 if(!context.env?.VISITORS_DB)return json({error:'accounts_unavailable'},503)
 const account=await trustedAccount(context,{allowUnregisteredDevice:true})
 if(!account)return json({authenticated:false},401)
 if(context.env.ACCOUNT_TEST_MODE==='true')return json({authenticated:true,claims:publicClaims(account)})
 const device=await registerDevice(context,account.subject,{label:'متصفح الحساب',platform:'web'})
 if(device.error)return json({error:device.error,authenticated:false},403)
 const response=json({authenticated:true,claims:publicClaims(account)})
 if(device.cookie)response.headers.append('set-cookie',device.cookie)
 return response
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
