import {json} from '../_account-contract.js'
import {quotePage} from '../_public-quotes.js'
export async function onRequestGet(context){try{return await quotePage(context)}catch{return json({error:'quotes_unavailable'},503)}}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})
