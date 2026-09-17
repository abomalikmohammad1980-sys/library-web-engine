import {h} from './ui'
const SESSION_COUNT_KEY='khizana:visit-recorded:v2'
const VISITORS_ENDPOINT = '/api/visitors'
/** No private totals are requested or displayed by the public shell. */
export function visitorCounter():HTMLElement{
 const element=h('span',{hidden:true,'aria-hidden':'true'})
 let recorded=false;try{recorded=sessionStorage.getItem(SESSION_COUNT_KEY)==='yes'}catch{}
 if(!recorded)void fetch(VISITORS_ENDPOINT,{method:'POST',credentials:'same-origin',headers:{accept:'application/json'}}).then(response=>{
  if (!response.ok) return
  try{sessionStorage.setItem(SESSION_COUNT_KEY,'yes')}catch{}
 }).catch(()=>{})
 return element
}
