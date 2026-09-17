import {h} from './ui'
import {sourceUiText} from './translation'
import type {AuthorStructuredFields} from './author_structured_fields'
import {authorRelationPicker} from './author_relation_picker'
export function mountAuthorInlineFields(content:HTMLElement,form:HTMLFormElement,baseline:AuthorStructuredFields,name:HTMLInputElement,text:HTMLTextAreaElement){
 const cleanup:Array<()=>void>=[],readers:Array<()=>[string,unknown]>=[]
 const body=content.querySelector('.person-page__body')!
 const mount=(title:string,inputs:HTMLElement[])=>{
  let section=[...body.querySelectorAll<HTMLElement>(':scope > .person-section')].find(s=>{const heading=s.querySelector('h2');return heading?sourceUiText(heading).startsWith(title):false})
  if(!section){section=h('section',{class:'person-section'},h('h2',null,title));body.append(section);const added=section;cleanup.push(()=>added.remove())}
  const hidden=[...section.children].filter(node=>node.tagName!=='H2') as HTMLElement[]
  const states=hidden.map(node=>node.hidden);hidden.forEach(node=>node.hidden=true)
  const editor=h('div',{class:'author-inline-fields'},...inputs);section.append(editor)
  cleanup.push(()=>{editor.remove();hidden.forEach((node,i)=>node.hidden=states[i]??false)})
 }
 const field=(key:keyof AuthorStructuredFields,label:string,kind:'date'|'text'|'list')=>{
  const value=baseline[key],input=kind==='list'?h('textarea',null):h('input',{type:kind==='date'?'number':'text'})
  input.value=Array.isArray(value)?value.join('\n'):value==null?'':String(value);input.setAttribute('form',form.id);input.setAttribute('aria-label',label)
  if(kind==='date'){input.setAttribute('min','-10000');input.setAttribute('max','3000');input.setAttribute('step','1')}
  readers.push(()=>[key,kind==='list'?input.value.split('\n').map(s=>s.trim()).filter(Boolean):kind==='date'?(input.value.trim()?Number(input.value):null):(input.value.trim()||null)])
  const labelNode=h('label',null,h('span',null,label),input)
  return key==='teachers'||key==='students'?h('div',null,labelNode,authorRelationPicker(input as HTMLTextAreaElement)):labelNode
 }
 const contemporary=h('input',{type:'checkbox','aria-label':'معاصر',style:'width:auto;min-height:auto;accent-color:var(--accent)'}) as HTMLInputElement
 contemporary.setAttribute('form',form.id)
 contemporary.checked=baseline.contemporary===true
 const deathFields=[field('deathHijri','الوفاة الهجرية','date'),field('deathGregorian','الوفاة الميلادية','date'),field('deathPlace','مكان الوفاة','text')]
 const sync=()=>{for(const label of deathFields)label.querySelector('input')!.disabled=contemporary.checked}
 contemporary.onchange=sync;sync()
 readers.push(()=>['contemporary',contemporary.checked])
 mount('الحياة والتاريخ',[field('birthHijri','الميلاد الهجري','date'),field('birthGregorian','الميلاد الميلادي','date'),h('label',{style:'display:flex;align-items:center;gap:.6rem'},contemporary,h('span',null,'معاصر')),...deathFields.slice(0,2),field('birthPlace','مكان الميلاد','text'),deathFields[2]!])
 mount('الأماكن',[field('places','الأماكن — مكان في كل سطر','list')])
 mount('الصفات والتصنيفات',[field('traits','الصفات — صفة في كل سطر','list'),field('categories','التصنيفات — تصنيف في كل سطر','list')])
 mount('العلاقات العلمية',[field('teachers','الشيوخ — اسم في كل سطر','list'),field('students','التلاميذ — اسم في كل سطر','list')])
 mount('المناصب',[field('positions','المناصب — منصب في كل سطر','list')])
 mount('المؤلفات وكتب الخزانة',[field('works','المؤلفات المعرّفة في الترجمة — عنوان في كل سطر','list'),h('p',null,'هذا يحرر قائمة الترجمة، ولا يحذف الكتب المرتبطة بالمكتبة.')])
 mount('الاسم والتعريف',[field('fullName','الاسم الكامل','text'),field('knownAs','اشتهر باسم — اسم في كل سطر','list'),field('lineage','النسب','text')])
 const biographyHeading=content.querySelector('.person-biography')?.closest('section.person-section')?.querySelector('h2')
 text.setAttribute('form',form.id);text.setAttribute('aria-label','نص الترجمة');mount(biographyHeading?sourceUiText(biographyHeading):'الترجمة المفصلة',[text])
 const title=content.querySelector<HTMLElement>('#person-title');name.setAttribute('form',form.id);name.setAttribute('aria-label','اسم المؤلف');title?.after(name);if(title){const hidden=title.hidden;title.hidden=true;cleanup.push(()=>{title.hidden=hidden;name.remove()})}
 return {read:():AuthorStructuredFields=>{
  const values=Object.fromEntries(readers.map(read=>read()))
  if(contemporary.checked){values.deathHijri=null;values.deathGregorian=null;values.deathPlace=null}
  return Object.fromEntries(Object.entries(values).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(baseline[key as keyof AuthorStructuredFields]))) as AuthorStructuredFields
 },close:()=>{for(const fn of cleanup.splice(0).reverse())fn()}}
}
