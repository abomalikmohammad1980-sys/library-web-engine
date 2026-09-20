import {h} from './ui'
import {icon} from './icons'
import {listBooks,currentLibraryIdentityScope,type StoredBook} from './engine/library_store'
import {legacyHashToPath} from './path_location'
import {addIndependentPdfEdition} from './independent_pdf_edition'
import {currentAccountClaims} from './account_authority'
import {loadCloudEditions,syncIndependentPdfEdition,cloudEditionHref,editionCloudId,linkExistingCloudPdf} from './independent_pdf_cloud'
import {listAccountBooksPage} from './account_service'

export function independentPdfPanel(book:StoredBook,editable=true,compact=false):HTMLElement{
 const scope=currentLibraryIdentityScope(),root=h('section',{class:'book-profile__section'}),list=h('div',null),status=h('p',{role:'status'})
 const current=()=>currentLibraryIdentityScope()===scope
 const cloud=h('div',null)
 const disclosure=compact?h('details',{class:'reader__edition-disclosure'}):undefined
 const summary=h('summary',{title:'الطبعات المرتبطة — عرض التفاصيل','aria-label':'الطبعات المرتبطة — عرض التفاصيل'},icon('book',18),h('span',{'aria-hidden':'true'},'…'))
 const updateSummary=()=>{
  if(!disclosure)return
  const count=list.querySelectorAll('a').length+cloud.querySelectorAll('a').length
  const label=count?`الطبعات المرتبطة: ${count} — عرض التفاصيل`:status.textContent?'تعذّر التحقق من بعض الطبعات — عرض التفاصيل':'لا توجد طبعات مرتبطة'
  summary.title=label;summary.setAttribute('aria-label',label)
  summary.replaceChildren(icon('book',18),h('span',{'aria-hidden':'true'},count?String(count):status.textContent?'!':'0'))
 }
 const setStatus=(message:string)=>{status.textContent=message;updateSummary()}
 const refresh=async()=>{const books=await listBooks();if(!current())return;const key=book.relatedWorkId||book.id;const editions=books.filter(other=>other.id!==book.id&&(other.relatedWorkId===key||other.id===key));list.replaceChildren(...editions.map(other=>{
  const row=h('p',null,h('a',{href:legacyHashToPath(`#/reader/${other.id}`)},`${other.title} — ${other.edition||'النسخة الأصلية'}${other.publisher?' — '+other.publisher:''}`))
  if(editable&&currentAccountClaims()&&other.sourceFormat==='pdf'&&other.relatedWorkId){
   const sync=h('button',{type:'button',class:'btn btn--secondary'},'حفظ الطبعة وربطها في حسابي') as HTMLButtonElement
   sync.onclick=async()=>{if(!current()||sync.disabled)return;sync.disabled=true;status.textContent='جارٍ حفظ الطبعة وربطها سحابيًا…';try{await syncIndependentPdfEdition(book,other);if(!current())return;status.textContent='حُفظت الطبعة وربطها في الحساب. النشر للعموم إجراء مستقل من مكتبي.';await refreshCloud()}catch(error){if(current())status.textContent=error instanceof Error?error.message:'تعذّر الحفظ السحابي'}finally{sync.disabled=false}};row.append(sync)
  }
  return row
 }));updateSummary()}
 const refreshCloud=async(page=0)=>{const result=await loadCloudEditions(book,page);if(!current()||!result)return;if(!page)cloud.replaceChildren();const own=editionCloudId(book),entries=[...(page===0&&result.parent?[result.parent]:[]),...result.editions].filter(entry=>entry.id!==own);cloud.append(...entries.map(entry=>h('p',null,h('a',{href:cloudEditionHref(entry)},`${entry.title}${entry.edition?' — '+entry.edition:''}${entry.publisher?' — '+entry.publisher:''}`))));if(result.hasMore){const more=h('button',{type:'button',class:'btn'},'المزيد من الطبعات') as HTMLButtonElement;more.onclick=()=>{more.remove();void refreshCloud(page+1).catch(()=>{if(current())status.textContent='تعذّر تحميل بقية الطبعات.'})};cloud.append(more)}}
 root.append(h('h3',null,'الطبعات المستقلة المرتبطة'),h('p',null,'لكل طبعة صفحاتها وفهرسها الخاص؛ لا تُزامن صفحاتها تلقائيًا مع النسخة النصية.'),list,cloud,status)
 if(editable){
  const file=h('input',{type:'file',accept:'.pdf,application/pdf','aria-label':'ملف طبعة PDF المستقلة'}) as HTMLInputElement
  const edition=h('input',{type:'text',placeholder:'اسم الطبعة أو وصفها','aria-label':'اسم طبعة PDF',maxlength:200}) as HTMLInputElement
  const publisher=h('input',{type:'text',placeholder:'ناشر هذه الطبعة (اختياري)','aria-label':'ناشر طبعة PDF',maxlength:200}) as HTMLInputElement
  const add=h('button',{type:'button',class:'btn btn--secondary'},'إضافة طبعة PDF مستقلة') as HTMLButtonElement
  add.onclick=async()=>{if(add.disabled||!current())return;const selected=file.files?.[0];if(!selected){status.textContent='اختر ملف PDF أولًا.';return}add.disabled=true;status.textContent='جارٍ حفظ الطبعة المستقلة…';try{await addIndependentPdfEdition(book,selected,edition.value,publisher.value);if(!current())return;status.textContent='حُفظت الطبعة في مكتبتك على هذا الجهاز. لم تُنشر للعموم.';file.value='';await refresh();window.dispatchEvent(new Event('library-changed'))}catch(error){if(current())status.textContent=error instanceof Error?error.message:'تعذّر حفظ الطبعة'}finally{add.disabled=false}}
  root.append(file,edition,publisher,add)
  if(currentAccountClaims()){
   const existing=h('select',{'aria-label':'طبعة PDF موجودة في حسابي'},h('option',{value:''},'اختر طبعة PDF من حسابك')) as HTMLSelectElement
   const load=h('button',{type:'button',class:'btn btn--secondary'},'عرض ملفات PDF في حسابي') as HTMLButtonElement
   const link=h('button',{type:'button',class:'btn btn--secondary'},'ربط الطبعة المختارة') as HTMLButtonElement
   let page=0
   load.onclick=async()=>{if(!current()||load.disabled)return;load.disabled=true;try{const result=await listAccountBooksPage(page,100);if(!current())return;for(const row of result.books)if(row.mimeType==='application/pdf'&&row.id!==editionCloudId(book))existing.append(h('option',{value:row.id},row.title));page++;load.hidden=!result.hasMore;load.textContent='تحميل بقية كتب الحساب';if(existing.options.length===1)status.textContent=result.hasMore?'لم يظهر PDF في هذه الصفحة؛ حمّل بقية كتب الحساب.':'لا توجد ملفات PDF متاحة في حسابك.'}catch(error){if(current())status.textContent=error instanceof Error?error.message:'تعذّر تحميل كتب الحساب'}finally{load.disabled=false}}
   link.onclick=async()=>{if(!current()||link.disabled||!existing.value)return;link.disabled=true;try{await linkExistingCloudPdf(book,existing.value);if(current()){status.textContent='رُبطت الطبعة المستقلة دون تغيير ملفها أو حالة نشرها.';await refreshCloud()}}catch(error){if(current())status.textContent=error instanceof Error?error.message:'تعذّر ربط الطبعة'}finally{link.disabled=false}}
   root.append(load,existing,link)
  }
 }
 void refresh().catch(()=>{if(current())setStatus('تعذّر تحميل الطبعات المرتبطة.')})
 void refreshCloud().then(updateSummary).catch(()=>{if(current())setStatus('تعذّر تحميل الطبعات السحابية؛ الطبعات المحلية محفوظة.')})
 if(disclosure){disclosure.append(summary,root);return disclosure}
 return root
}
