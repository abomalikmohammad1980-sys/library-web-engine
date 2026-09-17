import {h,toast} from './ui'
import {currentAccountClaims,hasAccountPermission} from './account_authority'
import {captureReadingIdentity} from './reading_identity_scope'
import {confirmCentralBookHide,centralBookRecordId} from './central_book_action'
import type {StoredBook} from './engine/library_store'
import {accountErrorArabic} from './account_service'

/** All writes go through central APIs, never the local book deletion API. */
export function publishedBookControls(book:StoredBook,editorHost:HTMLElement):HTMLElement{
 const root=h('span',{class:'book-profile__admin-actions'}),scope=captureReadingIdentity();
 const identity=currentAccountClaims();
 const route=routeLocation.hash;
 const current=()=>{const active=currentAccountClaims();return scope.isCurrent()&&active?.sessionId===identity?.sessionId&&active?.role===identity?.role&&routeLocation.hash===route&&root.isConnected};
 if(book.managedSource!=='published')return root;
 if(hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata')){
  const edit=h('button',{type:'button',class:'btn btn--secondary','aria-expanded':'false'},'تعديل') as HTMLButtonElement;
  edit.onclick=async(event)=>{
   event.preventDefault();event.stopPropagation();
   if(!current()||!hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata'))return;
   if(!editorHost.hidden){if(editorHost.querySelector('[data-bok-unsaved="true"]')&&!confirm('توجد تعديلات نصية غير محفوظة. هل تريد إخفاء المحرر؟'))return;editorHost.hidden=true;edit.setAttribute('aria-expanded','false');return}
   edit.disabled=true;
   try{
    const {publishedBookEditor}=await import('./screens/admin_books');
    const {independentPdfPanel}=await import('./independent_pdf_panel');
    if(!current()||!hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata'))return;
    editorHost.replaceChildren(publishedBookEditor(book,true),independentPdfPanel(book));editorHost.hidden=false;edit.setAttribute('aria-expanded','true');
    editorHost.scrollIntoView({block:'nearest'});
   }catch{if(current())toast('تعذّر فتح محرر الكتاب؛ أعد المحاولة.')}
   finally{edit.disabled=false}
  };root.append(edit);
 }
 if(hasAccountPermission(currentAccountClaims(),'book:logical-delete-published')){
  const remove=h('button',{type:'button',class:'btn btn--secondary'},'حذف') as HTMLButtonElement;
  remove.onclick=async(event)=>{
   event.preventDefault();event.stopPropagation();
   if(!current()||!hasAccountPermission(currentAccountClaims(),'book:logical-delete-published')||!confirmCentralBookHide(book.title))return;
   remove.disabled=true;
   try{
    const {loadCentralBookVersions,mutateCentralBook}=await import('./account_service');
    if(!current())return;
    const versions=await loadCentralBookVersions();
    if(!current()||!hasAccountPermission(currentAccountClaims(),'book:logical-delete-published'))return;
    const centralId=centralBookRecordId(book.id);
    await mutateCentralBook(centralId,{action:'delete',expectedVersion:versions.get(centralId)??0,note:'حذف من صفحة الكتاب'});
    if(current()){window.dispatchEvent(new Event('alkhizana:central-book-mutated'));window.dispatchEvent(new Event('library-changed'));toast('حُذف الكتاب من العرض العام؛ النسخة محفوظة للاسترجاع.');if(/^#\/(reader|book)\//.test(route))routeLocation.hash='#/library'}
   }catch(error){if(scope.isCurrent()&&routeLocation.hash===route&&root.isConnected)toast(accountErrorArabic(error,'تعذّر تأكيد حذف الكتاب. أعد المحاولة للتحقق من حالته؛ لم تُحذف نسخة محلية.'))}
   finally{remove.disabled=false}
  };root.append(remove);
 }
 return root;
}
import {routeLocation} from "./path_location"
