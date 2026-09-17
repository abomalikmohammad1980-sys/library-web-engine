import {passwordEntry} from '../_native-auth.js'
export const onRequestPost=context=>passwordEntry(context)
export const onRequest=()=>new Response(null,{status:405,headers:{allow:'POST'}})
