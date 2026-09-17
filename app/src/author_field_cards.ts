import {h} from './ui'
import {AUTHOR_FIELD_LABELS,biographyDateLabel,type AuthorStructuredFields} from './author_structured_fields'
import {uiTemplateText} from './ui_template_binding'
export function authorFieldsHistory(fields:AuthorStructuredFields={}){
 return h('pre',{style:'white-space:pre-wrap;overflow-wrap:anywhere'},...Object.entries(fields).flatMap(([key,value],index)=>[
  index?'\n':'',h('strong',null,AUTHOR_FIELD_LABELS[key as keyof AuthorStructuredFields]),': ',
  value===null||Array.isArray(value)&&!value.length?h('span',null,'محذوف من العرض'):h('span',{dataset:{noTranslate:''}},Array.isArray(value)?value.join('، '):String(value))
 ]))
}
export function authorFieldCards(fields:AuthorStructuredFields={}){
 const cards:HTMLElement[]=[]
 const add=(title:string,values:(string|null|undefined)[],protect=true)=>{const text=values.filter(Boolean) as string[];if(text.length)cards.push(h('section',{class:'person-section'},h('h2',null,title),...text.map(value=>h('p',protect?{dataset:{noTranslate:''}}:null,value))))}
 const date=(hijri?:number|null,gregorian?:number|null,place?:string|null)=>biographyDateLabel({...(hijri!=null?{hijri}:{}),...(gregorian!=null?{gregorian}:{}),...(place?{place}:{})})
 const birth=date(fields.birthHijri,fields.birthGregorian,fields.birthPlace),death=date(fields.deathHijri,fields.deathGregorian,fields.deathPlace)
 const dateRow=(label:string,hijri?:number|null,gregorian?:number|null,place?:string|null)=>{
  const value=hijri!=null?(gregorian!=null?uiTemplateText('40588a52a5e1d555',{p1:hijri,p2:gregorian}):uiTemplateText('d96dd32818403c90',{p1:hijri})):gregorian!=null?uiTemplateText('d77077887e94c16e',{p1:gregorian}):null
  return h('p',null,h('span',null,label),': ',value,place?h('span',null,value?' — ':'',h('span',{dataset:{noTranslate:''}},place)):null)
 }
 if(birth||death)cards.push(h('section',{class:'person-section'},h('h2',null,'الحياة والتاريخ'),birth?dateRow('الميلاد',fields.birthHijri,fields.birthGregorian,fields.birthPlace):null,death?dateRow('الوفاة',fields.deathHijri,fields.deathGregorian,fields.deathPlace):null))
 add('الاسم والتعريف',[fields.fullName,fields.lineage,...fields.knownAs??[]]);add('الأماكن',fields.places??[]);add('الصفات والتصنيفات',[...fields.traits??[],...fields.categories??[]]);add('الشيوخ',fields.teachers??[]);add('التلاميذ',fields.students??[]);add('المناصب',fields.positions??[]);add('المؤلفات',fields.works??[])
 return h('div',{class:'person-page__body'},...cards)
}
