import {h} from './ui'
import {currentAccountClaims} from './account_authority'
import {hydrateSubjectCategories,subjectCategories} from './subject_categories'
export function subjectCategoryPanel():HTMLElement{
 const host=h('section',{class:'library-admin','aria-label':'إدارة التصنيفات الموضوعية'})
 const actor=currentAccountClaims();if(!actor||!['super-admin','editor'].includes(actor.role))return host
 let busy=false,selectedId=''
 const valid=()=>{const now=currentAccountClaims();return now?.subject===actor.subject&&now.sessionId===actor.sessionId&&now.role===actor.role}
 const status=h('p',{'role':'status'})
 const render=()=>{
  if(!valid()){host.replaceChildren();return}
  const name=h('input',{'aria-label':'اسم التصنيف الجديد',maxlength:120}) as HTMLInputElement
  const add=h('button',{type:'button',class:'btn btn--primary'},'إضافة تصنيف') as HTMLButtonElement
  const save=async(id:string|undefined,value:string,revision?:number)=>{
   if(busy||!valid()||!value.trim())return
   busy=true;host.querySelectorAll('button').forEach(b=>(b as HTMLButtonElement).disabled=true);status.textContent='جارٍ الحفظ…'
   try{
    const response=await fetch('/api/admin/categories',{method:id?'PATCH':'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify(id?{id,name:value,expectedVersion:revision}:{name:value}),signal:AbortSignal.timeout(10000)})
    if(!valid())return
    if(!response.ok)throw Error(response.status===409?'تغيّر التصنيف أو أن الاسم مستخدم؛ حدّث الصفحة وراجع الاسم.':'تعذّر حفظ التصنيف. لم نؤكد أي تعديل.')
    await hydrateSubjectCategories(true)
    if(!valid())return
    status.textContent='حُفظ التصنيف؛ يظهر الاسم الجديد في أقسام المكتبة والكتب المرتبطة.'
    window.dispatchEvent(new Event('alkhizana:admin-books-mutated'))
    render()
   }catch(error){status.textContent=error instanceof Error?error.message:'تعذّر الحفظ.'}finally{busy=false;host.querySelectorAll('button').forEach(b=>(b as HTMLButtonElement).disabled=false)}
  }
  add.onclick=()=>void save(undefined,name.value)
  host.replaceChildren(h('h2',null,'التصنيفات الموضوعية'),h('p',null,'أضف تصنيفًا أو غيّر اسمه. تبقى الكتب والروابط القديمة مرتبطة به.'),h('div',{class:'library-admin__filters'},name,add),status)
  const items=subjectCategories()
  const select=h('select',{'aria-label':'التصنيف المراد تعديله'},...items.map(item=>h('option',{value:item.id},item.name))) as HTMLSelectElement
  if(items.some(item=>item.id===selectedId))select.value=selectedId
  const input=h('input',{maxlength:120,'aria-label':'الاسم الجديد للتصنيف',placeholder:'الاسم الجديد للتصنيف'}) as HTMLInputElement
  const button=h('button',{type:'button',class:'btn btn--secondary'},'حفظ الاسم') as HTMLButtonElement
  const sync=()=>{selectedId=select.value;input.value=items.find(item=>item.id===selectedId)?.name??'';button.disabled=!items.length;input.disabled=!items.length;select.disabled=!items.length}
  select.onchange=sync;sync()
  button.onclick=()=>{const item=items.find(item=>item.id===select.value);if(item)void save(item.id,input.value,item.revision)}
  host.append(h('div',{class:'admin-category-edit'},select,input,button))
 }
 render();return host
}
