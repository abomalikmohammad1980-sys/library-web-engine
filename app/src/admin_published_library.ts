import {h} from './ui'
import {pageJump} from './page_jump'
import {icon} from './icons'
import './styles/admin_published.css'
import {currentAccountClaims,hasAccountPermission} from './account_authority'
import {listBooks,type StoredBook} from './engine/library_store'
import {loadCentralBookVersions,mutateCentralBook,accountErrorArabic} from './account_service'
import {centralBookRecordId} from './central_book_action'
import {publishedBookControls} from './published_book_controls'
import {captureRouteResourceScope,routeEventListener,routeTimeout} from './resource_lifecycle'
import {renderBoundUiTemplate,uiTemplateText,uiTemplateAttribute} from './ui_template_binding'

/** A central-only management surface. Never sends published books to deleteBook. */
export function adminPublishedLibrary():HTMLElement{
 const scope=captureRouteResourceScope(),identity=currentAccountClaims()
 const host=h('section',{class:'library-admin published-manager','aria-label':'إدارة الكتب المنشورة'})
 const current=()=>!scope.disposed&&currentAccountClaims()?.subject===identity?.subject&&currentAccountClaims()?.sessionId===identity?.sessionId
 const canEdit=()=>current()&&hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata')
 const canDelete=()=>current()&&hasAccountPermission(currentAccountClaims(),'book:logical-delete-published')
 if(!canEdit())return host
 let books:StoredBook[]=[],busy=false,ready=false,loading=false,page=0,loadRevision=0,timer:number|undefined,pendingRefresh=false
 const pageSize=20
 const selected=new Set<string>()
 const query=h('input',{type:'search',class:'input',placeholder:'ابحث بعنوان الكتاب أو المؤلف…','aria-label':'بحث الكتب المنشورة'}) as HTMLInputElement
 const status=h('p',{role:'status'}),selection=h('p',{'aria-live':'polite'})
 const select=h('button',{type:'button',class:'btn'},'تحديد كتب الصفحة') as HTMLButtonElement
 const clear=h('button',{type:'button',class:'btn'},'مسح التحديد') as HTMLButtonElement
 const remove=h('button',{type:'button',class:'btn'},'حذف المحدد من المكتبة العامة') as HTMLButtonElement
 const previous=h('button',{type:'button',class:'btn'},'السابق') as HTMLButtonElement
 const next=h('button',{type:'button',class:'btn'},'التالي') as HTMLButtonElement
 const jump=pageJump('الكتب المنشورة',index=>{if(!busy){page=index;render()}})
 const retry=h('button',{type:'button',class:'btn'},'تحديث القائمة') as HTMLButtonElement
 const list=h('div',{class:'published-manager__list'})
 const filtered=()=>{const term=query.value.trim().toLocaleLowerCase('ar');return term.length<2?[]:books.filter(book=>`${book.title} ${book.author}`.toLocaleLowerCase('ar').includes(term))}
 const visible=()=>filtered().slice(page*pageSize,(page+1)*pageSize)
 const sync=()=>{
  selection.replaceChildren(query.value.trim().length<2?'اكتب حرفين على الأقل لتصفية الكتب.':uiTemplateText('published-selection-count',{p1:selected.size,p2:filtered().length,p3:page+1}))
  remove.hidden=!canDelete();remove.disabled=busy||!selected.size||!canDelete()
  select.disabled=busy||!ready||!visible().length||!canDelete();clear.disabled=busy||!selected.size
  previous.disabled=busy||page===0;next.disabled=busy||(page+1)*pageSize>=filtered().length
  previous.hidden=next.hidden=filtered().length<=pageSize
  jump.update(page,Math.ceil(filtered().length/pageSize),busy||loading)
  query.disabled=busy;retry.disabled=busy||loading;retry.hidden=!ready&&!status.textContent
 }
 const render=()=>{
  if(!canEdit()){host.replaceChildren();return}
  page=Math.max(0,Math.min(page,Math.ceil(filtered().length/pageSize)-1))
  list.replaceChildren(...visible().map(book=>{
   const row=h('div',{class:'published-manager__row'}),editor=h('section',{class:'published-manager__editor',hidden:true,'aria-label':'تعديل الكتاب'})
   if(canDelete()){
    const check=h('input',{type:'checkbox'}) as HTMLInputElement
    uiTemplateAttribute(check,'aria-label','published-select-title',{p1:book.title})
    check.checked=selected.has(book.id);check.disabled=busy
    check.onchange=()=>{if(!canDelete()||busy)return;check.checked?selected.add(book.id):selected.delete(book.id);sync()}
    row.append(check)
   }
   const actions=publishedBookControls(book,editor)
   for(const button of actions.querySelectorAll<HTMLButtonElement>('button')){
    const deleting=button.textContent==='حذف',label=deleting?'حذف الكتاب':'تعديل الكتاب'
    button.className='published-manager__icon'+(deleting?' published-manager__icon--danger':'')
    button.title=label;button.setAttribute('aria-label',label);button.replaceChildren(icon(deleting?'trash':'settings',20))
   }
   row.append(h('div',{class:'published-manager__identity',dataset:{noTranslate:''}},h('strong',null,book.title),h('small',null,book.author)),actions,editor)
   return row
  }));sync()
 }
 const load=async(preserveStatus=false)=>{
  if(!canEdit())return
  if(busy||loading){pendingRefresh=true;return}
  loading=true
  const revision=++loadRevision;if(!preserveStatus)status.textContent='جارٍ تحميل الكتب المنشورة…'
  try{
   const loaded=await listBooks({requireCompleteCatalog:true})
   if(!canEdit()||revision!==loadRevision)return
   books=loaded.filter(book=>book.managedSource==='published');ready=true
   const ids=new Set(books.map(book=>book.id));for(const id of selected)if(!ids.has(id))selected.delete(id)
   if(!preserveStatus)status.textContent='';render()
  }catch(error){if(current()&&revision===loadRevision)status.textContent=accountErrorArabic(error,'تعذّر تحميل القائمة؛ أعد المحاولة.')}
  finally{loading=false;if(current()){sync();if(pendingRefresh){pendingRefresh=false;void load(true)}}}
 }
 query.oninput=()=>{window.clearTimeout(timer);page=0;selected.clear();if(query.value.trim().length<2){render();return}timer=routeTimeout(()=>{if(!canEdit())return;render();if(!ready)void load()},200,scope)}
 select.onclick=()=>{if(!canDelete()||busy)return;for(const book of visible())selected.add(book.id);render()}
 clear.onclick=()=>{if(busy)return;selected.clear();render()}
 previous.onclick=()=>{page--;render()};next.onclick=()=>{page++;render()};retry.onclick=()=>void load()
 remove.onclick=async()=>{
  if(!canDelete()||busy||!selected.size)return
  const chosen=books.filter(book=>selected.has(book.id))
  if(!confirm(renderBoundUiTemplate('published-delete-confirm',{p1:chosen.length,p2:chosen.slice(0,3).map(book=>`«${book.title}»`).join('، ')},document.documentElement.lang||'ar')))return
  busy=true;render();let deleted=0;const failures:string[]=[]
  try{
   const versions=await loadCentralBookVersions()
   for(const book of chosen){
    if(!canDelete())break
    try{const id=centralBookRecordId(book.id);await mutateCentralBook(id,{action:'delete',expectedVersion:versions.get(id)??0,note:'حذف جماعي من لوحة الإدارة'})
     if(!canDelete())break
     selected.delete(book.id);books=books.filter(item=>item.id!==book.id);deleted++
    }catch(error){if(!canDelete())break;failures.push(accountErrorArabic(error,'تعذّر حذف أحد الكتب.'))}
   }
   if(current())status.replaceChildren(uiTemplateText('published-delete-count',{p1:deleted}),...(failures.length?[uiTemplateText('published-delete-failures',{p1:failures.length}),h('span',null,failures[0]!)]:[]))
  }catch(error){if(current())status.textContent=accountErrorArabic(error,'تعذّر تحميل إصدارات الكتب؛ لم يبدأ الحذف.')}
  finally{busy=false;if(current()){render();if(deleted){window.dispatchEvent(new Event('alkhizana:central-book-mutated'));window.dispatchEvent(new Event('library-changed'))}}}
 }
 routeEventListener(window,'alkhizana:account-changed',()=>{selected.clear();if(canEdit())render();else host.replaceChildren()},undefined,scope)
 routeEventListener(window,'library-changed',()=>{if(canEdit())void load(true)},undefined,scope)
 select.prepend(icon('check',18));clear.prepend(icon('close',18));remove.prepend(icon('trash',18));retry.prepend(icon('repeat',18))
 host.append(h('h2',null,icon('book',24),'إدارة الكتب المنشورة'),h('label',{class:'published-manager__search'},icon('search',20),query),h('div',{class:'published-manager__toolbar'},select,clear,remove),selection,status,retry,list,h('nav',{'aria-label':'صفحات الكتب المنشورة'},previous,jump.element,next))
 sync();return host
}
