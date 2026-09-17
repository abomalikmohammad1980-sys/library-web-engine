import {h} from './ui'
import {icon} from './icons'
import {currentAccountClaims,hasAccountPermission} from './account_authority'
import {loadCentralBookVersions,mutateCentralBook,accountErrorArabic} from './account_service'
import {centralBookRecordId} from './central_book_action'
import type {StoredBook} from './engine/library_store'

/** Selection is limited to this filtered list; central books never use local writes. */
export function publishedGridSelection(){
 let identity=currentAccountClaims()
 const selected=new Set<string>()
 let books:StoredBook[]=[],busy=false
 const current=()=>{const claims=currentAccountClaims();return claims?.sessionId===identity?.sessionId&&claims?.subject===identity?.subject}
 const allowed=()=>current()&&hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata')
 const canDelete=()=>allowed()&&hasAccountPermission(currentAccountClaims(),'book:logical-delete-published')
 const host=h('section',{class:'library-admin__bulk',hidden:true,'aria-label':'تحديد كتب القائمة'})
 const count=h('span',{'aria-live':'polite'}),status=h('span',{role:'status'})
 const all=h('button',{type:'button',class:'btn btn--secondary'},icon('check',18),'تحديد الكتب المعروضة') as HTMLButtonElement
 const clear=h('button',{type:'button',class:'btn btn--secondary'},'مسح التحديد') as HTMLButtonElement
 const author=h('input',{class:'input',placeholder:'المؤلف الجديد (اختياري)','aria-label':'المؤلف الجماعي'}) as HTMLInputElement
 const category=h('input',{class:'input',placeholder:'التصنيف الجديد (اختياري)','aria-label':'التصنيف الجماعي'}) as HTMLInputElement
 const apply=h('button',{type:'button',class:'btn'},'تعديل المحدد') as HTMLButtonElement
 const remove=h('button',{type:'button',class:'btn btn--secondary'},icon('trash',18),'حذف المحدد') as HTMLButtonElement
 let controls:HTMLInputElement[]=[]
 const cards=new Map<string,HTMLElement>()
 const sync=()=>{
  host.hidden=!allowed()||(!books.length&&!status.textContent);count.textContent=`${selected.size} كتاب محدد`
  all.disabled=clear.disabled=busy;apply.disabled=busy||!selected.size;remove.disabled=busy||!selected.size
  remove.hidden=!canDelete();author.disabled=category.disabled=busy
  for(const check of controls){check.checked=selected.has(check.value);check.disabled=busy||!allowed()}
 }
 all.onclick=()=>{if(!allowed()||busy)return;for(const check of controls)selected.add(check.value);sync()}
 clear.onclick=()=>{if(busy)return;selected.clear();sync()}
 const run=async(action:'update'|'delete')=>{
  if(busy||!allowed()||!selected.size||(action==='delete'&&!canDelete()))return
  const fields={...(author.value.trim()?{author:author.value.trim()}:{}),...(category.value.trim()?{category:category.value.trim()}: {})}
  if(action==='update'&&!Object.keys(fields).length){status.textContent='أدخل المؤلف أو التصنيف المراد تعديله.';return}
  if(!confirm(`${action==='delete'?'حذف':'تعديل'} ${selected.size} كتاب من المكتبة العامة؟`))return
  const targets=books.filter(book=>selected.has(book.id))
  busy=true;sync();let done=0;const errors:string[]=[]
  try{
   const versions=await loadCentralBookVersions()
   for(const book of targets){
    if(!allowed()||(action==='delete'&&!canDelete()))break
    try{const id=centralBookRecordId(book.id);await mutateCentralBook(id,{action,expectedVersion:versions.get(id)??0,...(action==='update'?fields:{})});if(!current())break;selected.delete(book.id);done++;if(action==='delete'){cards.get(book.id)?.remove();cards.delete(book.id);controls=controls.filter(check=>check.value!==book.id);books=books.filter(item=>item.id!==book.id)}sync()}
    catch(error){errors.push(accountErrorArabic(error,'تعذّر تنفيذ العملية.'))}
   }
  }catch(error){errors.push(accountErrorArabic(error,'تعذّر تحميل إصدارات الكتب.'))}
  finally{busy=false;if(current()){status.textContent=`تم ${action==='delete'?'حذف':'تعديل'} ${done} كتاب.${errors.length?' '+errors[0]:''}`;sync();if(done){window.dispatchEvent(new Event('alkhizana:central-book-mutated'));window.dispatchEvent(new Event('library-changed'))}}}
 }
 apply.onclick=()=>void run('update');remove.onclick=()=>void run('delete')
 host.append(all,clear,count,author,category,apply,remove,status)
 return {host,reset(next:StoredBook[]){if(!current()){selected.clear();if(!busy)identity=currentAccountClaims()}books=next.filter(book=>book.managedSource==='published');controls=[];cards.clear();const ids=new Set(books.map(book=>book.id));for(const id of selected)if(!ids.has(id)||!allowed())selected.delete(id);sync()},decorate(card:HTMLElement,book:StoredBook){
  if(!allowed()||book.managedSource!=='published')return
  const check=h('input',{type:'checkbox',class:'library-card__select','aria-label':`تحديد ${book.title}`}) as HTMLInputElement
  check.value=book.id;check.addEventListener('click',event=>event.stopPropagation());check.onchange=()=>{if(!allowed()||busy)return;check.checked?selected.add(book.id):selected.delete(book.id);sync()}
  controls.push(check);cards.set(book.id,card);card.prepend(check);sync()
 }}
}
