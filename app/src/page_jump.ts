import {h} from './ui'

export function requestedPage(value:string,total:number):number|null{
 const normalized=value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))
 if(!/^\d+$/.test(normalized))return null
 const page=Number(normalized)
 return Number.isSafeInteger(page)&&page>=1&&page<=total?page-1:null
}
/** Shared page counter and direct-jump control; callers own data loading. */
export function pageJump(label:string,onPage:(page:number)=>void){
 let total=1
 const status=h('span',{role:'status','aria-live':'polite'})
 const input=h('input',{type:'text','aria-label':`رقم الصفحة — ${label}`,value:'1',style:'width:5rem'}) as HTMLInputElement
 input.inputMode='numeric'
 const go=h('button',{type:'button',class:'btn btn--secondary'},'انتقال') as HTMLButtonElement
 const submit=()=>{const page=requestedPage(input.value,total);input.setCustomValidity(page===null?`أدخل رقم صفحة من 1 إلى ${total}`:'');if(page===null){input.reportValidity();return}onPage(page)}
 go.onclick=submit;input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submit()}})
 const element=h('div',{class:'page-jump'},status,input,go)
 return{element,update(page:number,pages:number|undefined,busy=false){total=pages===undefined?Number.MAX_SAFE_INTEGER:Math.max(1,pages);status.textContent=pages===undefined?`الصفحة ${page+1}`:`الصفحة ${page+1} من ${total}`;input.value=String(page+1);input.disabled=go.disabled=busy;input.setCustomValidity('')}}
}
