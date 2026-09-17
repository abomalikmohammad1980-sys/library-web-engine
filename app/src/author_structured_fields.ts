import type {StructuredBiography,BiographyDate} from './author_people'
export function biographyDateLabel(value?:BiographyDate):string {
 if(!value)return ''
 const date=value.hijri!=null?`${value.hijri} هـ${value.gregorian!=null?` (الموافق: ${value.gregorian} م)`:''}`:value.gregorian!=null?`${value.gregorian} م`:''
 return [date,value.place].filter(Boolean).join(' — ')
}
export interface AuthorStructuredFields {contemporary?:boolean}
export interface AuthorStructuredFields {birthHijri?:number|null;birthGregorian?:number|null;deathHijri?:number|null;deathGregorian?:number|null;birthPlace?:string|null;deathPlace?:string|null;fullName?:string|null;lineage?:string|null;knownAs?:string[];places?:string[];traits?:string[];categories?:string[];teachers?:string[];students?:string[];positions?:string[];works?:string[]}
export const AUTHOR_FIELD_LABELS:Readonly<Record<keyof AuthorStructuredFields,string>>={contemporary:'معاصر',birthHijri:'الميلاد الهجري',birthGregorian:'الميلاد الميلادي',deathHijri:'الوفاة الهجرية',deathGregorian:'الوفاة الميلادية',birthPlace:'مكان الميلاد',deathPlace:'مكان الوفاة',fullName:'الاسم الكامل',lineage:'النسب',knownAs:'اشتهر باسم',places:'الأماكن',traits:'الصفات',categories:'التصنيفات',teachers:'الشيوخ',students:'التلاميذ',positions:'المناصب',works:'المؤلفات'}
export function authorFieldsSummary(fields?:AuthorStructuredFields):string {
 const labels=AUTHOR_FIELD_LABELS
 return Object.entries(fields??{}).map(([key,value])=>`${labels[key as keyof AuthorStructuredFields]}: ${value===null||Array.isArray(value)&&!value.length?'محذوف من العرض':Array.isArray(value)?value.join('، '):value}`).join('\n')
}
export function validAuthorStructuredFields(value:unknown):value is AuthorStructuredFields {
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const safeText=(text:unknown,max:number)=>typeof text==='string'&&text.length<=max&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)
 for(const [key,item] of Object.entries(value)){
  if(['birthHijri','birthGregorian','deathHijri','deathGregorian'].includes(key)){if(item!==null&&(!Number.isInteger(item)||item< -10000||item>3000))return false}
  else if(['birthPlace','deathPlace','fullName','lineage'].includes(key)){if(item!==null&&!safeText(item,500))return false}
  else if(['knownAs','places','traits','categories','teachers','students','positions','works'].includes(key)){if(!Array.isArray(item)||item.length>50||item.some(text=>!safeText(text,key==='works'?500:300)||!text.trim()))return false}
  else if(key==='contemporary'){if(typeof item!=='boolean')return false}
  else return false
 }
 const fields=value as AuthorStructuredFields
 if(fields.contemporary&&(fields.deathHijri!=null||fields.deathGregorian!=null||fields.deathPlace))return false
 for(const [birth,death] of [[fields.birthHijri,fields.deathHijri],[fields.birthGregorian,fields.deathGregorian]])if(birth!=null&&death!=null&&death<birth)return false
 return new TextEncoder().encode(JSON.stringify(value)).length<=32768
}
export function biographyFields(b:StructuredBiography):AuthorStructuredFields{
 return {...(b.contemporary!==undefined?{contemporary:b.contemporary}:{}),birthHijri:b.birth?.value.hijri??null,birthGregorian:b.birth?.value.gregorian??null,deathHijri:b.death?.value.hijri??null,deathGregorian:b.death?.value.gregorian??null,birthPlace:b.birth?.value.place??null,deathPlace:b.death?.value.place??null,fullName:b.fullName?.value??null,lineage:b.lineage?.value??null,...Object.fromEntries(['knownAs','places','traits','categories','teachers','students','positions','works'].map(key=>[key,(b as any)[key]?.value??[]]))}
}
export function mergeBiographyFields(b:StructuredBiography,fields?:AuthorStructuredFields):StructuredBiography{
 if(!fields)return b
 const result=structuredClone(b),source={provider:'local' as const,sourceUrl:'local:central-author-edit',verifiedAt:'',citationTitle:'تحرير مركزي'}
 for(const key of ['fullName','lineage','knownAs','places','traits','categories','teachers','students','positions','works'] as const)if(Object.hasOwn(fields,key)){const value=fields[key];if(value===null)delete result[key];else (result as any)[key]={...source,value}}
 for(const kind of ['birth','death'] as const){const value={...result[kind]?.value};let changed=false;for(const suffix of ['Hijri','Gregorian','Place'] as const){const key=`${kind}${suffix}` as keyof AuthorStructuredFields;if(!Object.hasOwn(fields,key))continue;changed=true;const property=suffix.toLowerCase();if(fields[key]===null)delete (value as any)[property];else (value as any)[property]=fields[key]}
  if(changed){delete value.calculation;(result as any)[kind]={...source,value};delete result.reportedAge}}
 if(fields.teachers!==undefined)delete result.teacherLinks
 if(fields.students!==undefined)delete result.studentLinks
 if(fields.contemporary!==undefined)result.contemporary=fields.contemporary
 if(result.contemporary){delete result.death;delete result.reportedAge}
 return result
}
