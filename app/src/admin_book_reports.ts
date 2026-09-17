import {h} from './ui'
import {pageJump} from './page_jump'
import {uiTemplateText} from './ui_template_binding'
import {currentAccountClaims} from './account_authority'
export function accountReportsControl(owner:string,count?:number):HTMLElement{
 const rows=h('div',{class:'admin-account-reports'}),trigger=h('summary',{class:'btn btn--secondary'},'التعليقات والبلاغات'+(count===undefined?'':` · ${count}`)),host=h('details',null,trigger,rows)
 const identity=currentAccountClaims();let loaded=false,ticket=0
 const load=async(page=0)=>{
  const token=++ticket;rows.textContent='جارٍ تحميل البلاغات…'
  try{
   const response=await fetch(`/api/admin/book-reports?owner=${encodeURIComponent(owner)}&page=${page}`,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)})
   if(!response.ok)throw Error();const data=await response.json()
   if(token!==ticket||currentAccountClaims()?.subject!==identity?.subject||currentAccountClaims()?.sessionId!==identity?.sessionId)return
   if(!Array.isArray(data.reports)||data.reports.length>30||data.page!==page||typeof data.hasMore!=='boolean')throw Error()
   rows.replaceChildren();for(const r of data.reports){
    if(typeof r.bookId!=='string'||typeof r.bookTitle!=='string'||typeof r.message!=='string')throw Error()
    const params=new URLSearchParams(),p=r.context??{}
    if(Number.isSafeInteger(p.pageIndex)&&p.pageIndex>=0)params.set('pageIndex',String(p.pageIndex))
    if(Number.isSafeInteger(p.paragraphIndex)&&p.paragraphIndex>=0)params.set('para',String(p.paragraphIndex))
    if(Number.isSafeInteger(p.part)&&p.part>0)params.set('part',String(p.part))
    if(Number.isSafeInteger(p.page)&&p.page>0)params.set('page',String(p.page))
    rows.append(h('article',{class:'oversight-event'},h('a',{href:`#/reader/${encodeURIComponent(r.bookId)}?${params}`,dataset:{noTranslate:''}},r.bookTitle),h('p',null,'النوع: ',r.kind==='comment'?'تعليق عام':r.kind==='correction'?'تصحيح نص':'بلاغ'),...(typeof p.selectedText==='string'?[h('blockquote',{dataset:{noTranslate:''}},p.selectedText)]:[]),h('p',{dataset:{noTranslate:''}},r.message),h('small',null,p.page?uiTemplateText('e539ec82d9b52370',{p1:typeof p.page==='number'?p.page:String(p.page)}):'تعليق عام على الكتاب')))
   }
   if(!data.reports.length)rows.append(h('p',null,'لا توجد تعليقات أو بلاغات لهذا الحساب.'))
   const nav=h('nav',{'aria-label':'صفحات البلاغات'});for(const [label,index,disabled]of [['السابق',page-1,page===0],['التالي',page+1,!data.hasMore]] as const)nav.append(h('button',{type:'button',class:'btn btn--secondary',disabled,onclick:()=>void load(index)},label));const jump=pageJump('البلاغات',index=>{void load(index)});jump.update(page,count===undefined?undefined:Math.ceil(count/30));nav.append(jump.element);rows.append(nav)
   loaded=true
  }catch{if(token===ticket)rows.replaceChildren(h('p',null,'تعذّر تحميل البلاغات.'),h('button',{type:'button',onclick:()=>void load(page)},'إعادة المحاولة'))}
 }
 host.addEventListener('toggle',()=>{if(host.open&&!loaded)void load()});window.addEventListener('alkhizana:account-changed',()=>{ticket++;rows.replaceChildren();host.remove()},{once:true})
 return host
}
