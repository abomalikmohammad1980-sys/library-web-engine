import {h} from './ui'
import {icon} from './icons'

export function requestedPage(value:string,total:number):number|null{
 const normalized=value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))
 if(!/^\d+$/.test(normalized))return null
 const page=Number(normalized)
 return Number.isSafeInteger(page)&&page>=1&&page<=total?page-1:null
}
/** Shared page counter and direct-jump control; callers own data loading. */
export function pageJump(label:string,onPage:(page:number)=>void,compact=false){
 let total=1
 const status=h('span',{role:'status','aria-live':'polite'})
 const input=h('input',{type:'text','aria-label':`رقم الصفحة — ${label}`,value:'1',style:compact?'width:3rem':'width:5rem'}) as HTMLInputElement
 const totalLabel=h('span',{class:'page-jump__total','aria-hidden':'true'},'/ 1')
 input.inputMode='numeric'
 const go=h('button',{type:'button',class:'btn btn--secondary',title:'الانتقال إلى الصفحة','aria-label':'الانتقال إلى الصفحة'},...(compact?[icon('chevron-left',18)]:['انتقال'])) as HTMLButtonElement
 const submit=()=>{const page=requestedPage(input.value,total);input.setCustomValidity(page===null?`أدخل رقم صفحة من 1 إلى ${total}`:'');if(page===null){input.reportValidity();return}onPage(page)}
 go.onclick=submit;input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submit()}})
 if(compact)status.className='sr-only'
 const element=h('div',{class:compact?'page-jump page-jump--compact':'page-jump'},status,input,...(compact?[totalLabel]:[]),go)
 return{element,update(page:number,pages:number|undefined,busy=false){total=pages===undefined?Number.MAX_SAFE_INTEGER:Math.max(1,pages);status.textContent=pages===undefined?`الصفحة ${page+1}`:`الصفحة ${page+1} من ${total}`;totalLabel.textContent=pages===undefined?'':`/ ${total}`;input.value=String(page+1);input.disabled=go.disabled=busy;input.setCustomValidity('')}}
}
