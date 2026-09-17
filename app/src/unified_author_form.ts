import {h} from './ui'
import './styles/unified_author_form.css'
import {validAuthorStructuredFields,type AuthorStructuredFields} from './author_structured_fields'
export interface UnifiedAuthorDraft {displayName:string;biography:string;fields:AuthorStructuredFields;contemporary:boolean;publishPublic:boolean}
export const unifiedAuthorTextFields=[
 ['fullName','الاسم الكامل'],['lineage','النسب'],['birthPlace','مكان الميلاد'],['deathPlace','مكان الوفاة'],
] as const
export const unifiedAuthorListFields=[
 ['knownAs','اشتهر باسم'],['places','الأماكن'],['traits','الصفات'],['categories','التصنيفات'],['teachers','الشيوخ'],['students','التلاميذ'],['positions','المناصب'],['works','المؤلفات'],
] as const
export const splitAuthorFieldList=(value:string):string[]=>[...new Set(value.split(/[\n،,]+/u).map(x=>x.trim()).filter(Boolean))]
export function unifiedAuthorForm(options:{canPublish:boolean;initial?:Partial<UnifiedAuthorDraft>;label?:string;onSave:(draft:UnifiedAuthorDraft)=>Promise<void>;onCancel?:()=>void}):HTMLFormElement{
 const initial=options.initial,initialFields=initial?.fields??{}
 const form=h('form',{class:'unified-author-form','aria-label':options.label??'إضافة مؤلف'}) as HTMLFormElement
 const save=h('button',{type:'submit',class:'btn btn--primary'},'حفظ الترجمة') as HTMLButtonElement
 const cancel=h('button',{type:'button',class:'btn btn--secondary'},'إلغاء');cancel.onclick=()=>options.onCancel?options.onCancel():routeLocation.hash='#/authors'
 const publish=h('input',{type:'checkbox'}) as HTMLInputElement;publish.checked=false
 form.append(h('div',{class:'authors-add-actions'},save,cancel))
 if(options.canPublish)form.append(h('label',null,publish,'نشر عام في الموقع'))
 const grid=h('div',{class:'unified-author-form__grid'}),name=h('input',{'aria-label':'اسم المؤلف',maxlength:300}) as HTMLInputElement
 name.required=true
 name.value=initial?.displayName??''
 const box=(label:string,control:HTMLElement)=>h('label',{class:'person-section'},h('strong',null,label),control)
 grid.append(box('اسم المؤلف',name))
 const controls=new Map<keyof AuthorStructuredFields,HTMLInputElement|HTMLTextAreaElement>()
 for(const [key,label] of unifiedAuthorTextFields){const input=h('input',{'aria-label':label,maxlength:500}) as HTMLInputElement;controls.set(key,input);grid.append(box(label,input))}
 for(const [key,label] of unifiedAuthorListFields){const input=h('textarea',{'aria-label':label,placeholder:'كل اسم في سطر، أو افصل الأسماء بفاصلة'}) as HTMLTextAreaElement;input.rows=3;controls.set(key,input);grid.append(box(label,input))}
 const contemporary=h('input',{type:'checkbox'}) as HTMLInputElement
 contemporary.checked=initial?.contemporary??false
 for(const [key,control] of controls){const value=initialFields[key];control.value=Array.isArray(value)?value.join('\n'):typeof value==='string'?value:''}
 for(const [key,label] of [['birthHijri','سنة الميلاد الهجرية'],['deathHijri','سنة الوفاة الهجرية']] as const){
  const hijri=h('input',{type:'number','aria-label':label}) as HTMLInputElement,gregorian=h('input',{'aria-label':label.replace('الهجرية','الميلادية التقريبية')}) as HTMLInputElement
  hijri.min='-10000';hijri.max='3000';gregorian.readOnly=true;controls.set(key,hijri)
  const gregorianKey=key==='birthHijri'?'birthGregorian':'deathGregorian'
  hijri.value=initialFields[key]==null?'':String(initialFields[key])
  const sync=()=>{const valid=hijri.value!==''&&Number.isSafeInteger(Number(hijri.value)),unchanged=(hijri.value===''?null:Number(hijri.value))===(initialFields[key]??null);gregorian.value=unchanged&&initialFields[gregorianKey]!=null?String(initialFields[gregorianKey]):valid?String(Math.round(Number(hijri.value)-Number(hijri.value)/33+622)):'';if(key==='deathHijri'){const deceased=valid||unchanged&&initialFields.deathGregorian!=null;contemporary.disabled=deceased;if(deceased)contemporary.checked=false}}
  sync()
  hijri.oninput=sync;grid.append(box(label,h('div',null,hijri,h('small',null,'الميلادي التقريبي للعرض فقط'),gregorian)))
 }
 const biography=h('textarea',{'aria-label':'الترجمة التفصيلية',maxlength:20000}) as HTMLTextAreaElement;biography.rows=8
 biography.value=initial?.biography??''
 form.append(grid,h('label',null,contemporary,'معاصر'),box('الترجمة التفصيلية',biography))
 const status=h('p',{role:'status'});form.append(status);let busy=false
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return
  const fields:AuthorStructuredFields={birthGregorian:null,deathGregorian:null}
  for(const [key] of unifiedAuthorTextFields)fields[key]=controls.get(key)!.value.trim()||null
  for(const [key] of unifiedAuthorListFields)fields[key]=splitAuthorFieldList(controls.get(key)!.value)
  for(const key of ['birthHijri','deathHijri'] as const){const value=controls.get(key)!.value;fields[key]=value===''?null:Number(value)}
  for(const [hijri,gregorian] of [['birthHijri','birthGregorian'],['deathHijri','deathGregorian']] as const)if(fields[hijri]===(initialFields[hijri]??null))fields[gregorian]=initialFields[gregorian]??null
  if(!name.value.trim()||!validAuthorStructuredFields(fields)){status.textContent='راجع الاسم والتواريخ وعدد الأسماء في الحقول قبل الحفظ.';return}
  busy=true;save.disabled=true;status.textContent='جارٍ الحفظ…'
  try{await options.onSave({displayName:name.value.trim(),biography:biography.value.trim(),fields,contemporary:fields.deathHijri!=null||fields.deathGregorian!=null?false:contemporary.checked,publishPublic:options.canPublish&&publish.checked});status.textContent='حُفظت الترجمة.'}
  catch(error){status.textContent=error instanceof Error?error.message:'تعذّر حفظ الترجمة.'}
  finally{busy=false;save.disabled=false}
 }
 return form
}
import {routeLocation} from "./path_location"
