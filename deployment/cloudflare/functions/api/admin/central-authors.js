import {mutateCentralAuthor} from '../_central-author-contract.js'
import {json} from '../_account-contract.js'
export const onRequestPost=context=>mutateCentralAuthor(context,true)
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'POST'})
