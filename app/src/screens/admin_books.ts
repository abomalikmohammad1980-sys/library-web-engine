import { currentAccountClaims, hasAccountPermission } from '../account_authority'
import {pageJump} from '../page_jump'
import { pageContent } from '../components'
import { updatePublishedBookAsAdmin, type StoredBook } from '../engine/library_store'
import { stateView } from '../state_view'
import { h, toast } from '../ui'
import {uiTemplateText,uiTemplateAttribute} from '../ui_template_binding'
import { downloadArtifact } from '../artifact_download'
import { silentSkeleton } from '../silent_skeleton'
import { publicPageHero } from '../public_page_hero'
import { accountBookReviewFilePath, accountErrorArabic, decideBookSubmission, listBookSubmissionsPage, loadAccountAdminMembersPage, loadAccountAdminStats, loadAccountMemberBooks, loadCentralBookVersions, loadCompleteAccountAdminAudit, mutateCentralBook, submitCentralBookCandidate, type AccountAdminMember, type AccountAdminStats, type AccountBookSubmission, type AccountReviewStatusFilter } from '../account_service'
import { bookOrdinal } from '../book_ordering'
import { authorLink, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import { accountSubmissionFacts } from '../account_submission_presentation'
import { confirmCentralBookHide,centralBookRecordId } from '../central_book_action'
import { accountBlockControls } from '../account_block_controls'
import { accountRoleControls } from '../account_role_controls'
import { createCentralBook } from '../account_service'
import { bookImportManager } from '../book_import'
import { centralBookUploadWithWordBundle } from '../central_book_upload'
import {captureCentralImportGuard} from '../central_import_guard'
import {oversightPanel} from '../oversight_panel'
import {subjectCategoryPanel} from '../subject_category_panel'
import {icon} from '../icons'
import {adminAudiencePanel} from '../admin_audience'
import {adminPublishedLibrary} from '../admin_published_library'
import {accountReportsControl} from '../admin_book_reports'
import {editorialRecommendationsPanel} from '../editorial_recommendations_panel'
import {createSubmissionFilterCache,type SubmissionPage} from '../submission_filter_cache'
import {appendBokEditorLaunch} from '../bok_editor_launch'
import {adminIndexingPanel} from '../admin_indexing_panel'

export function adminBooksScreen(): HTMLElement {
  const claims = currentAccountClaims()
  const root = pageContent(publicPageHero({ eyebrow: 'إدارة الخِزانة', title: 'لوحة الإدارة', titleId: 'admin-books-title', description: 'إضافة الكتب وإدارة المهام المتاحة لصلاحية حسابك. تحرير الكتاب المنشور متاح من صفحته.', className: 'page-hero' }))
  const canReview = hasAccountPermission(claims, 'book:review-submissions')
  root.classList.add('admin-dashboard')
  const canEditPublished = hasAccountPermission(claims, 'book:edit-published-metadata')
  if (!canReview && !canEditPublished) {
    root.append(stateView({ kind: 'empty', icon: 'person', title: 'هذه الصفحة للمدير العام', description: 'يلزم تسجيل دخول موثّق بصلاحية المدير العام. لا تكفي بيانات محفوظة محليًا لمنح هذه الصلاحية.' }))
    return root
  }
  const exportAudit = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تصدير سجل التعديلات') as HTMLButtonElement
  exportAudit.addEventListener('click', () => void exportServerAudit(exportAudit))
  const submissions=h('section',{class:'library-admin','aria-label':'إضافات المستخدمين','aria-busy':'true'},h('h2',null,'إضافات المستخدمين'),silentSkeleton('cards'))
  const stats=h('section',{class:'library-admin','aria-label':'ملخص الحسابات والكتب','aria-busy':'true'},h('h2',null,'ملخص الحسابات والكتب'),silentSkeleton('cards'))
  const statsController=new AbortController()
  window.addEventListener('popstate',()=>statsController.abort(),{once:true})
  window.addEventListener('alkhizana:account-changed',()=>statsController.abort(),{once:true,signal:statsController.signal})
  window.addEventListener('alkhizana:admin-books-mutated',()=>{const active=currentAccountClaims();if(canReview&&root.isConnected&&active?.subject===claims?.subject&&active?.sessionId===claims?.sessionId)void hydrateAdminStats(stats)},{signal:statsController.signal})
  const changed=()=>window.dispatchEvent(new Event('alkhizana:admin-books-mutated'))
  if(canReview||canEditPublished)root.append(h('section',{class:'admin-dashboard__import','aria-label':'الإضافة المركزية'},centralBookCandidateForm(async()=>{changed();if(canReview)await hydrateSubmissions(submissions)})))
  if (claims?.role==='super-admin') root.append(h('div',{class:'admin-dashboard__toolbar'},exportAudit))
  const reviewWorkspace=h('section',{class:'library-admin admin-review-workspace','aria-label':'مراجعة الكتاب',hidden:true})
  if(canReview){
    root.append(reviewWorkspace,stats)
    root.addEventListener('admin:review-book',event=>{
      const book=(event as CustomEvent<AccountBookSubmission>).detail
      if(!hasAccountPermission(currentAccountClaims(),'book:review-submissions'))return
      reviewWorkspace.hidden=false
      const render=(row:AccountBookSubmission)=>reviewWorkspace.replaceChildren(h('h2',null,'مراجعة الكتاب'),submissionRow(row,async restore=>{
        let found:AccountBookSubmission|undefined
        for(let page=0;page<=10000;page++){const result=await listBookSubmissionsPage('all',page);found=result.submissions.find(item=>item.id===row.id);if(found||!result.hasMore)break}
        if(found){render(found);const note=reviewWorkspace.querySelector<HTMLInputElement>('[data-review-note]');if(restore&&note){note.value=restore.note;note.focus()}}
        else reviewWorkspace.replaceChildren(h('p',null,'لم يعد الكتاب متاحًا للمراجعة.'))
        void hydrateSubmissions(submissions)
      }))
      render(book);reviewWorkspace.scrollIntoView({behavior:'smooth',block:'start'})
    })
  }
  if(claims?.role==='super-admin')root.append(adminAudiencePanel(),oversightPanel(changed))
  if(claims?.role==='super-admin'||claims?.role==='admin')root.append(adminIndexingPanel())
  if(canEditPublished)root.append(subjectCategoryPanel())
  if (canReview) { root.append(submissions); void hydrateAdminStats(stats); void hydrateSubmissions(submissions) }
  if (canEditPublished) root.append(adminPublishedLibrary())
  if(canEditPublished)root.append(editorialRecommendationsPanel())
  return root
}

export function publishedBookEditor(book:StoredBook,openImmediately=false):HTMLElement{
 const host=h('section',{'aria-label':'تحرير بيانات الكتاب'})
 if(book.managedSource!=='published'||!hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata'))return host
 const toggle=h('button',{type:'button',class:'btn btn--secondary'},'تحرير بيانات الكتاب') as HTMLButtonElement
 host.append(toggle)
 const open=async()=>{toggle.disabled=true;const identity=currentAccountClaims();try{const versions=await loadCentralBookVersions();const current=currentAccountClaims();if(!identity||current?.subject!==identity.subject||current.sessionId!==identity.sessionId||!hasAccountPermission(current,'book:edit-published-metadata'))return;host.replaceChildren(adminRow(book,versions.get(centralBookRecordId(book.id))??0,0));void appendBokEditorLaunch(host,book)}catch(error){toast(accountErrorArabic(error,'تعذّر تحميل بيانات التحرير.'))}finally{toggle.disabled=false}}
 toggle.onclick=open;if(openImmediately)void open()
 return host
}

function centralBookCandidateForm(refresh:()=>Promise<void>):HTMLElement{
  const role=currentAccountClaims()?.role
  if(role!=='editor'&&role!=='super-admin')return h('p',null,'إضافة كتبك ورفعها للمراجعة متاحة من مكتبتي.')
  return bookImportManager(()=>{void refresh().catch(()=>undefined)},{
    centralSave:{save:async input=>{const guard=captureCentralImportGuard();const upload=await centralBookUploadWithWordBundle(input);guard();return createCentralBook(upload)}},
  })
}

async function exportServerAudit(button:HTMLButtonElement):Promise<void>{button.disabled=true;try{const events=await loadCompleteAccountAdminAudit();downloadArtifact({fileName:`alkhizana-admin-audit-${new Date().toISOString().slice(0,10)}.json`,mimeType:'application/json;charset=utf-8',content:JSON.stringify({version:2,exportedAt:new Date().toISOString(),events},null,2)});toast('صُدّر سجل التدقيق المركزي كاملًا.')}catch(error){toast(accountErrorArabic(error,'تعذّر تصدير سجل التدقيق.'))}finally{button.disabled=false}}

async function hydrateAdminStats(host:HTMLElement):Promise<void>{
  try{const stats=await loadAccountAdminStats();host.removeAttribute('aria-busy');host.replaceChildren(h('h2',null,'ملخص الحسابات والكتب'),adminStatsView(stats),accountMembersPanel())}
  catch{host.removeAttribute('aria-busy');host.replaceChildren(h('h2',null,'ملخص الحسابات والكتب'),stateView({kind:'error',title:'تعذّر تحميل الإحصاءات',description:'لم تتغير بيانات الحسابات أو الكتب.',actionLabel:'إعادة المحاولة',onAction:()=>void hydrateAdminStats(host)}))}
}
function accountMembersPanel():HTMLElement{const panel=h('section',{'aria-labelledby':'account-members-title','aria-busy':'true'},h('h3',{id:'account-members-title'},'الحسابات المسجلة'),silentSkeleton('cards'));void hydrateAccountMembers(panel);return panel}
const accountMembersGeneration=new WeakMap<HTMLElement,number>()
async function hydrateAccountMembers(panel:HTMLElement,page=0):Promise<void>{
 const generation=(accountMembersGeneration.get(panel)??0)+1;accountMembersGeneration.set(panel,generation)
 const identity=currentAccountClaims(),scope=()=>{const active=currentAccountClaims();return accountMembersGeneration.get(panel)===generation&&active?.subject===identity?.subject&&active?.sessionId===identity?.sessionId&&active?.role===identity?.role}
 try{
  panel.setAttribute('aria-busy','true');const {accounts,hasMore,total}=await loadAccountAdminMembersPage(page,50);if(!scope())return
  const pages=Math.max(1,total===undefined?page+1+Number(hasMore):Math.ceil(total/50))
  if(page>=pages){void hydrateAccountMembers(panel,pages-1);return}
  const nav=h('nav',{class:'admin-accounts__pagination','aria-label':'صفحات الحسابات'})
  const go=(index:number,label:string,current=false)=>{const button=h('button',{type:'button',class:'btn btn--secondary','aria-label':label,'aria-current':index===page?'page':undefined,disabled:current},label);button.onclick=()=>void hydrateAccountMembers(panel,index);return button}
  const indices=new Set([0,pages-1]);for(let index=Math.max(0,page-2);index<=Math.min(pages-1,page+2);index++)indices.add(index)
  const previous=go(Math.max(0,page-1),'السابق',page===0);nav.append(previous)
  let last=-1;for(const index of [...indices].sort((a,b)=>a-b)){if(last>=0&&index-last>1)nav.append(h('span',{'aria-hidden':'true'},'…'));nav.append(go(index,String(index+1),index===page));last=index}
  nav.append(go(page+1,'التالي',!hasMore))
  const jump=pageJump('الحسابات',index=>{void hydrateAccountMembers(panel,index)})
  jump.update(page,pages);nav.append(jump.element)
  panel.removeAttribute('aria-busy');panel.replaceChildren(h('div',{class:'admin-accounts__heading'},h('h3',{id:'account-members-title'},'الحسابات المسجلة'),h('span',null,total===undefined?'50 حساب في الصفحة':uiTemplateText('493a337062d8404b',{p1:total}))),h('div',{class:'admin-accounts__list'},...(accounts.length?accounts.map(accountMemberRow):[h('p',null,'لا توجد حسابات مسجلة بعد.')])),nav)
 }catch{if(!scope())return;panel.removeAttribute('aria-busy');if(panel.querySelector('.admin-account-row')){toast('تعذّر تحميل الصفحة المطلوبة؛ بقيت الحسابات الظاهرة كما هي.');return}panel.replaceChildren(h('h3',{id:'account-members-title'},'الحسابات المسجلة'),stateView({kind:'error',title:'تعذّر تحميل تفصيل الحسابات',description:'بقيت إحصاءات الكتب وأدوات المراجعة متاحة.',actionLabel:'إعادة المحاولة',onAction:()=>void hydrateAccountMembers(panel,page)}))}
}
function accountMemberRow(member:AccountAdminMember):HTMLElement{
 const details=h('div',{class:'admin-account-row__books',dataset:{accountBooks:''}}),button=h('button',{class:'btn btn--secondary',type:'button','aria-expanded':'false'},icon('book',17),h('span',null,'عرض كتب الحساب')) as HTMLButtonElement
 button.onclick=()=>void toggleAccountMemberBooks(member,button,details)
 const manage=h('div',null,accountReportsControl(member.accountId,member.reportsTotal),h('details',{class:'admin-account-row__manage'},h('summary',{class:'btn btn--secondary'},icon('settings',17),h('span',null,'إدارة الحساب')),h('div',{class:'admin-account-row__management'},accountBlockControls(member.accountId),accountRoleControls(member))))
 const badge=(label:string,count:number)=>h('span',{class:'admin-account-row__count',title:label},h('strong',null,count.toLocaleString('ar')),h('span',null,label))
 return h('article',{class:'admin-account-row'},h('div',{class:'admin-account-row__header'},h('div',{class:'admin-account-row__identity'},icon('person',20),h('div',null,h('strong',{dataset:{noTranslate:''}},member.displayName),h('small',{dataset:{noTranslate:''}},member.email))),h('div',{class:'admin-account-row__counts'},badge('الكتب',member.booksTotal),badge('بانتظار المراجعة',member.pending),badge('مقبولة',member.approved),badge('مرفوضة',member.rejected)),h('div',{class:'admin-account-row__actions'},button,manage)),details)
}
async function toggleAccountMemberBooks(member:AccountAdminMember,button:HTMLButtonElement,details:HTMLElement):Promise<void>{if(button.getAttribute('aria-expanded')==='true'){button.setAttribute('aria-expanded','false');button.replaceChildren(icon('book',17),h('span',null,'عرض كتب الحساب'));details.replaceChildren();return}button.disabled=true;details.setAttribute('aria-busy','true');details.replaceChildren(silentSkeleton('cards'));try{const books=await loadAccountMemberBooks(member.accountId);button.setAttribute('aria-expanded','true');button.replaceChildren(icon('book',17),h('span',null,'إخفاء كتب الحساب'));details.removeAttribute('aria-busy');details.replaceChildren(...(books.length?books.map(accountMemberBookRow):[h('p',null,'لا توجد كتب مرتبطة بهذا الحساب.')]))}catch{details.removeAttribute('aria-busy');details.replaceChildren(stateView({kind:'error',title:'تعذّر تحميل كتب الحساب',description:'لم تتغير بيانات الحساب أو قرارات الكتب.',actionLabel:'إعادة المحاولة',onAction:()=>void toggleAccountMemberBooks(member,button,details)}))}finally{button.disabled=false}}
export const submissionReaderHref=(id:string)=>`#/reader/${encodeURIComponent(`account-book:${id}`)}`
function bookFileLink(book:AccountBookSubmission):HTMLElement{return h('a',{class:'admin-book-file',href:submissionReaderHref(book.id),target:'_blank',rel:'noopener',title:'قراءة الكتاب داخل الخزانة'},icon('book',17),h('strong',{dataset:{noTranslate:''}},book.title))}
function reviewBookButton(book:AccountBookSubmission):HTMLButtonElement{
 const button=h('button',{class:'btn btn--secondary',type:'button',title:'مراجعة الكتاب','aria-label':`مراجعة ${book.title}`},icon('settings',17),h('span',null,'مراجعة')) as HTMLButtonElement
 uiTemplateAttribute(button,'aria-label','344ba0449a3eabd2',{p1:book.title})
 button.onclick=()=>button.dispatchEvent(new CustomEvent('admin:review-book',{bubbles:true,detail:book}))
 return button
}
function accountMemberBookRow(book:AccountBookSubmission):HTMLElement{return h('div',{class:'admin-submission-quick'},bookFileLink(book),h('span',{dataset:{noTranslate:''}},book.author),reviewBookButton(book))}
function quickSubmissionRow(book:AccountBookSubmission):HTMLElement{return h('article',{class:'admin-submission-quick',dataset:{submissionId:book.id}},bookFileLink(book),h('span',{dataset:{noTranslate:''}},book.author),h('small',{dataset:{noTranslate:''}},book.ownerEmail??''),reviewBookButton(book))}

function adminStatsView(stats:AccountAdminStats):HTMLElement{
  const item=(label:string,value:number)=>h('div',{class:'admin-dashboard__stat'},h('strong',null,value.toLocaleString('ar')),h('span',null,label))
  return h('div',{class:'admin-dashboard__stats'},item('الحسابات المسجلة',stats.accountsTotal),item('كتب المستخدمين',stats.booksTotal),item('بانتظار المراجعة',stats.pending),item('كتب مقبولة',stats.approved),item('كتب مرفوضة',stats.rejected),item('منشورة للعامة',stats.publicBooks),item('كتب خاصة',stats.privateBooks),item('محاولات تجاوز حد الأجهزة خلال ٢٤ ساعة',stats.deviceLimitRejections24h??0))
}

type SubmissionPanelState={identity:string;ticket:number;filter:HTMLSelectElement;list:HTMLElement;message:HTMLElement;cache:ReturnType<typeof createSubmissionFilterCache>}
const submissionPanels=new WeakMap<HTMLElement,SubmissionPanelState>()
const submissionIdentity=()=>{const c=currentAccountClaims();return JSON.stringify([c?.subject,c?.sessionId,c?.role])}
export async function hydrateSubmissions(host:HTMLElement,restore?:{bookId:string;note:string},page=0,append=false,refresh=true):Promise<void>{
 if(!hasAccountPermission(currentAccountClaims(),'book:review-submissions'))return
 let state=submissionPanels.get(host)
 if(!state||state.identity!==submissionIdentity()){
  const filter=h('select',{'aria-label':'حالة مراجعة كتب المستخدمين',dataset:{reviewStatus:''}},...([['pending','بانتظار المراجعة'],['approved','المقبولة'],['rejected','المرفوضة'],['all','كل الحالات']] as const).map(([value,label])=>h('option',{value},label))) as HTMLSelectElement
  const list=h('div',{class:'admin-submissions-list'}),message=h('p',{role:'status','aria-live':'polite'})
  state={identity:submissionIdentity(),ticket:0,filter,list,message,cache:createSubmissionFilterCache((status,page)=>listBookSubmissionsPage(status,page,50,'',true))};submissionPanels.set(host,state)
  const reload=h('button',{type:'button',class:'btn btn--secondary'},'تحديث');reload.onclick=()=>void hydrateSubmissions(host)
  filter.onchange=()=>void hydrateSubmissions(host,undefined,0,false,false)
  host.replaceChildren(h('h2',null,'إضافات المستخدمين'),h('div',{class:'admin-submissions-filter'},filter,reload),message,list)
 }
 if(refresh)state.cache.clear()
 const currentState=state,ticket=++state.ticket,status=state.filter.value as AccountReviewStatusFilter
 const current=()=>submissionPanels.get(host)===currentState&&ticket===currentState.ticket&&currentState.identity===submissionIdentity()&&host.isConnected
 const {list,message,cache}=state
 const render=({submissions:rows,hasMore}:SubmissionPage)=>{
  host.removeAttribute('aria-busy');message.textContent='';list.querySelector('[data-submissions-more]')?.remove()
  const known=new Set(append?[...list.querySelectorAll<HTMLElement>('[data-submission-id]')].map(x=>x.dataset.submissionId):[])
  const cards=rows.filter(row=>!known.has(row.id)).map(quickSubmissionRow)
  if(!append)list.replaceChildren(...(cards.length?cards:[h('p',null,'لا توجد كتب في هذه الحالة.')]))
  else list.append(...cards)
  if(hasMore){const more=h('button',{class:'btn btn--secondary',type:'button',dataset:{submissionsMore:''}},'تحميل كتب أقدم') as HTMLButtonElement;more.onclick=()=>{more.disabled=true;void hydrateSubmissions(host,undefined,page+1,true,false)};list.append(more)}
  if(restore){const draft=h('textarea',{'aria-label':'ملاحظة المراجعة المحفوظة بعد التعارض'},restore.note) as HTMLTextAreaElement;list.prepend(h('aside',{class:'notice',role:'status'},h('strong',null,'احتُفظ بملاحظتك بعد تعارض القرار'),draft));draft.focus()}
 }
 const cached=cache.peek(status,page);if(cached){render(cached);return}
 host.setAttribute('aria-busy','true');message.textContent='جارٍ تحميل الكتب في الحالة المختارة…'
 if(!append)list.replaceChildren(silentSkeleton('cards'))
 try{const result=await cache.load(status,page);if(current())render(result)}
 catch{if(!current())return;host.removeAttribute('aria-busy');message.textContent='تعذّر تحميل الحالة المختارة؛ لم يتغير أي كتاب.';if(!append)list.replaceChildren();const retry=h('button',{class:'btn btn--secondary',type:'button'},'إعادة المحاولة');retry.onclick=()=>{retry.remove();void hydrateSubmissions(host,restore,page,append,false)};list.append(retry)}
}

export function submissionRow(book:AccountBookSubmission,refresh:(restore?:{bookId:string;note:string})=>Promise<void>):HTMLElement{
  const field=(label:string,value:string,maxlength:number)=>h('input',{value,maxlength,'aria-label':label,dataset:{noTranslate:''}}) as HTMLInputElement
  const title=field('اسم الكتاب',book.title,300),author=field('اسم المؤلف',book.author,200),category=field('التصنيف الموضوعي',book.category??'',200)
  const editor=h('fieldset',{class:'admin-review-editor'},h('legend',null,'تصحيح بيانات الكتاب قبل النشر'),h('label',null,'اسم الكتاب',title),h('label',null,'اسم المؤلف',author),h('label',null,'التصنيف الموضوعي',category))
  const actions:HTMLButtonElement[]=[]
  const note=h('input',{placeholder:'ملاحظة المراجعة','aria-label':`ملاحظة مراجعة ${book.title}`,maxlength:1000,dataset:{reviewNote:''}}) as HTMLInputElement
  const facts=h('dl',{class:'library-admin__submission-facts'},...accountSubmissionFacts(book).map(fact=>h('div',null,h('dt',null,fact.label),h('dd',{dataset:{noTranslate:''}},fact.value))))
  const act=(decision:'publish'|'private'|'reject',label:string)=>{
    const button=h('button',{class:decision==='publish'?'btn btn--primary':'btn btn--secondary',type:'button',title:label,'aria-label':label},icon(decision==='publish'?'globe':decision==='private'?'lock':'close',17),h('span',null,label)) as HTMLButtonElement
    actions.push(button)
    button.onclick=async()=>{
      if(!title.value.trim()||!author.value.trim()){toast('أدخل اسم الكتاب واسم المؤلف قبل حفظ القرار.');(!title.value.trim()?title:author).focus();return}
      actions.forEach(action=>action.disabled=true);editor.disabled=true;note.disabled=true
      let committed=false
      try{
        await decideBookSubmission(book.id,decision,note.value,book.reviewVersion??0,{title:title.value.trim(),author:author.value.trim(),category:category.value.trim()})
        committed=true
        toast('حُفظ قرار المراجعة');window.dispatchEvent(new Event('alkhizana:admin-books-mutated'));await refresh()
      }catch(error){
        if(committed)toast('حُفظت التصحيحات وقرار المراجعة، لكن تعذّر تحديث القائمة. حدّث الصفحة لرؤية الحالة الجديدة.')
        else if(error instanceof Error&&error.message==='account_review_conflict')toast('تغيّرت بيانات الكتاب؛ بقيت تصحيحاتك هنا ولم تُنشر. افتح المراجعة مجددًا لمقارنة أحدث نسخة قبل الاعتماد.')
        else toast(accountErrorArabic(error,'تعذّر حفظ القرار؛ بقيت تصحيحاتك ولم تُنشر.'))
      }finally{actions.forEach(action=>action.disabled=committed);editor.disabled=committed;note.disabled=committed}
    }
    return button
  }
  return h('article',{class:'admin-review-card',dataset:{submissionId:book.id}},
    bookFileLink(book),
    h('span',{dataset:{noTranslate:''}},book.author),
    h('small',{dataset:{noTranslate:''}},book.ownerEmail??''),
    h('span',null,book.reviewStatus==='pending'?'بانتظار المراجعة':book.reviewStatus==='approved'?(book.visibility==='public'?'مقبول ومنشور':'مقبول وخاص'):'مرفوض'),
    facts,editor,h('p',{class:'admin-review-editor__hint'},'تُحفظ التصحيحات مع قرار المراجعة؛ لا يُنشر الكتاب حتى تختار نشر للعامة.'),...(book.reviewNote?[h('small',{dataset:{noTranslate:''}},book.reviewNote)]:[]),h('div',{class:'admin-review-actions'},h('a',{class:'btn btn--secondary',href:submissionReaderHref(book.id),target:'_blank',rel:'noopener'},icon('book',17),'قراءة الكتاب داخل الخزانة'),note,act('publish','نشر للعامة'),act('private','إبقاء خاصًا'),act('reject','رفض')))
}

function adminRow(book: StoredBook,initialVersion:number,index:number): HTMLElement {
  let version=initialVersion
  const ordinal=bookOrdinal(index)
  const title = h('input', { value: book.title, dataset: { noTranslate: '' }, 'aria-label': `عنوان ${book.title}` }) as HTMLInputElement
  const author = h('input', { value: book.author, dataset: { noTranslate: '' }, 'aria-label': `مؤلف ${book.title}` }) as HTMLInputElement
  const category = h('input', { value: book.categoryOverride?.value ?? book.category ?? '', dataset: { noTranslate: '' }, placeholder: 'التصنيف', 'aria-label': `تصنيف ${book.title}` }) as HTMLInputElement
  const visibility = h('select', { 'aria-label': `ظهور ${book.title}` },
    ...(['public', 'unlisted', 'hidden'] as const).map(value => h('option', { value, selected: (book.visibility ?? 'public') === value }, value === 'public' ? 'ظاهر' : value === 'unlisted' ? 'برابط مباشر' : 'مخفي'))) as HTMLSelectElement
  const save = h('button', { class: 'btn btn--primary', type: 'button' }, 'حفظ') as HTMLButtonElement
  save.addEventListener('click', () => void mutate(book.id, { title: title.value, author: author.value, category: category.value || null,...(hasAccountPermission(currentAccountClaims(),'book:edit-published-visibility')?{visibility: visibility.value as StoredBook['visibility']}: {}) }, save,()=>version,value=>{version=value}))
  const remove=h('button',{class:'btn btn--secondary',type:'button'},'إخفاء منطقي') as HTMLButtonElement;remove.onclick=()=>{if(confirmCentralBookHide(book.title))void centralMutation(book.id,{action:'delete',expectedVersion:version,note:'حذف منطقي من لوحة الإدارة'},remove,value=>{version=value})}
  const restore=h('button',{class:'btn btn--secondary',type:'button'},'استعادة') as HTMLButtonElement;restore.onclick=()=>void centralMutation(book.id,{action:'restore',expectedVersion:version,visibility:'public',note:'استعادة من لوحة الإدارة'},restore,value=>{version=value})
  return h('article', { class: 'library-admin__row', 'aria-label': `${ordinal.label}: ${book.title}` },
    h('span',{class:'book-card__ordinal','aria-hidden':'true'},String(ordinal.number)),
    h('strong', null, h('a', { href: `#/reader/${book.id}`, dataset: { noTranslate: '' } }, book.title)),
    h('span',{class:'library-admin__taxonomy'},authorLink(book.author,undefined,book.authorId),categoryLink(effectiveBookCategory(book))),
    title, author, category,...(hasAccountPermission(currentAccountClaims(),'book:edit-published-visibility')?[visibility]:[]), save,...(hasAccountPermission(currentAccountClaims(),'book:logical-delete-published')?[remove,restore]:[]))
}

async function mutate(id: string, values: Parameters<typeof updatePublishedBookAsAdmin>[2], button: HTMLButtonElement,version:()=>number,setVersion:(value:number)=>void): Promise<void> {
  button.disabled = true
  try { const result=await mutateCentralBook(centralBookRecordId(id),{action:'update',expectedVersion:version(),...(values.title?{title:values.title}:{}),...(values.author?{author:values.author}:{}),category:values.category?.trim()||null,...(values.visibility?{visibility:values.visibility}:{})});setVersion(result.revision);window.dispatchEvent(new Event('alkhizana:central-book-mutated'));window.dispatchEvent(new Event('library-changed'));try{await updatePublishedBookAsAdmin(currentAccountClaims(), id, values)}catch{/* A transient/public-reader record need not exist in IndexedDB. The central save succeeded. */}toast('حُفظ التعديل الإداري مركزيًا') }
  catch (error) { toast(accountErrorArabic(error,'تعذّر حفظ التعديل.')) }
  finally { button.disabled = false }
}
async function centralMutation(id:string,input:Parameters<typeof mutateCentralBook>[1],button:HTMLButtonElement,setVersion:(value:number)=>void):Promise<void>{button.disabled=true;try{const result=await mutateCentralBook(centralBookRecordId(id),input);setVersion(result.revision);window.dispatchEvent(new Event('alkhizana:central-book-mutated'));window.dispatchEvent(new Event('library-changed'));toast(input.action==='delete'?'أُخفي الكتاب منطقيًا':'أُعيد الكتاب إلى الظهور')}catch(error){toast(accountErrorArabic(error,'تعذّر تنفيذ الإجراء.'))}finally{button.disabled=false}}
