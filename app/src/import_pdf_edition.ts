import {h} from './ui'
import {getBook} from './engine/library_store'
import {addIndependentPdfEdition} from './independent_pdf_edition'

/** Optional second edition; never writes the Word reference PDF or page map. */
export function importPdfEdition(){
 const file=h('input',{type:'file',accept:'.pdf,application/pdf','aria-label':'ملفات PDF الرديفة'}) as HTMLInputElement
 file.multiple=true
 const entries:Array<{file:File;edition:HTMLInputElement;publisher:HTMLInputElement}>=[]
 const field=(text:string,input:HTMLInputElement)=>h('label',{class:'import-field'},h('span',null,text),input)
 const list=h('div',{class:'import-pdf-edition__list'})
 const root=h('details',{class:'import-pdf-edition'},h('summary',null,'إرفاق طبعات PDF رديفة'),h('p',null,'لكل طبعة صفحاتها ورابطها في بطاقة الكتاب، دون استبدال نسخة Word.'),field('اختر ملف PDF أو عدة ملفات',file),list) as HTMLDetailsElement
 file.addEventListener('change',()=>{
  for(const selected of Array.from(file.files??[])){
   if(entries.some(entry=>entry.file.name===selected.name&&entry.file.size===selected.size&&entry.file.lastModified===selected.lastModified))continue
   const edition=h('input',{type:'text',maxlength:200,value:selected.name.replace(/\.pdf$/i,''),'aria-label':'اسم الطبعة الرديفة'}) as HTMLInputElement
   const publisher=h('input',{type:'text',maxlength:200,'aria-label':'ناشر الطبعة الرديفة'}) as HTMLInputElement
   const entry={file:selected,edition,publisher},remove=h('button',{type:'button',class:'btn btn--secondary','aria-label':'إزالة '+selected.name},'×')
   const row=h('div',{class:'import-pdf-edition__fields'},h('span',{dataset:{noTranslate:''}},selected.name),field('اسم الطبعة *',edition),field('الناشر (اختياري)',publisher),remove)
   remove.onclick=()=>{entries.splice(entries.indexOf(entry),1);row.remove()}
   entries.push(entry);list.append(row)
  }
  file.value=''
 })
 return {root,selected:()=>entries.length>0,selections:()=>entries.slice(),valid:()=>{const invalid=entries.find(entry=>!entry.edition.value.trim());if(!invalid)return true;root.open=true;invalid.edition.focus();return false},async save(parentId:string,entry:typeof entries[number]){
  const book=await getBook(parentId);if(!book)throw Error('تعذّر العثور على الكتاب لربط الطبعة الرديفة.')
  return addIndependentPdfEdition(book,entry.file,entry.edition.value,entry.publisher.value)
 }}
}
