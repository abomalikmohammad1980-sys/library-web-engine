export interface SubjectCategory {id:string;name:string;aliases:string[];revision:number}
export const DEFAULT_SUBJECT_NAMES = [
  'العقيدة', 'الفرق والردود', 'التفسير', 'علوم القرآن وأصول التفسير', 'التجويد والقراءات',
  'كتب السنة', 'شروح الحديث', 'التخريج والأطراف', 'العلل والسؤلات الحديثية', 'علوم الحديث',
  'أصول الفقه', 'علوم الفقه والقواعد الفقهية', 'المنطق', 'الفقه الحنفي', 'الفقه المالكي',
  'الفقه الشافعي', 'الفقه الحنبلي', 'الفقه العام', 'مسائل فقهية', 'السياسة الشرعية والقضاء',
  'الفرائض والوصايا', 'الفتاوى', 'الرقائق والآداب والأذكار', 'السيرة النبوية', 'التاريخ',
  'التراجم والطبقات', 'الأنساب', 'البلدان والرحلات', 'كتب اللغة', 'الغريب والمعاجم',
  'النحو والصرف', 'الأدب', 'العروض والقوافي', 'الشعر ودواوينه', 'البلاغة', 'الجوامع',
  'فهارس الكتب والأدلة', 'الطب', 'كتب عامة', 'علوم أخرى',
]
let categories:SubjectCategory[]=DEFAULT_SUBJECT_NAMES.map((name,index)=>({id:'subject:'+String(index+1),name,aliases:[name,...(name==='التفسير'?['التفاسير']:[])],revision:1}))
const normalize=(value:string)=>value.normalize('NFC').trim().replace(/\s+/gu,' ')
let lookup=new Map<string,string>()
export const SUBJECT_CATEGORY_NAMES:string[]=[]
export function installSubjectCategories(input:unknown):void{
 if(!Array.isArray(input)||!input.length||input.length>1000)throw Error('invalid_categories')
 const next:SubjectCategory[]=[],aliases=new Map<string,string>(),ids=new Set<string>()
 for(const row of input){
  if(!row||typeof row.id!=='string'||!/^subject:[a-zA-Z0-9-]{1,50}$/.test(row.id)||ids.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>120||/[<>\u0000-\u001f]/.test(row.name)||!Number.isSafeInteger(row.revision)||row.revision<1||!Array.isArray(row.aliases)||!row.aliases.length||row.aliases.length>1000)throw Error('invalid_categories')
  ids.add(row.id);const values:string[]=[]
  for(const raw of [...row.aliases,row.name,row.id]){if(typeof raw!=='string'||raw.length>120)throw Error('invalid_alias');const value=normalize(raw);if(!value||aliases.has(value)&&aliases.get(value)!==row.name)throw Error('duplicate_alias');aliases.set(value,row.name);values.push(value)}
  next.push({id:row.id,name:row.name,revision:row.revision,aliases:values.filter(x=>x!==row.id)})
 }
 categories=next;lookup=aliases;SUBJECT_CATEGORY_NAMES.splice(0,SUBJECT_CATEGORY_NAMES.length,...next.map(row=>row.name))
}
installSubjectCategories(categories)
const CACHE_KEY='alkhizana:subject-categories:v1'
try{const cached=localStorage.getItem(CACHE_KEY);if(cached&&cached.length<=512000)installSubjectCategories(JSON.parse(cached))}catch{/* Public metadata cache is optional. */}
export const subjectCategories=():readonly SubjectCategory[]=>categories.map(row=>({...row,aliases:[...row.aliases]}))
export const subjectCategoryNames=():string[]=>categories.map(row=>row.name)
export const canonicalSubjectCategory=(name:string):string=>lookup.get(normalize(name))??normalize(name)
let pending:Promise<void>|undefined,lastLoaded=0,lastAttempt=0
export async function hydrateSubjectCategories(force=false):Promise<void>{
 if(pending)return pending
 if(!force&&(Date.now()-lastLoaded<30000||Date.now()-lastAttempt<30000))return
 lastAttempt=Date.now()
 pending=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1800);try{
  const response=await fetch('/api/library/categories',{signal:controller.signal,credentials:'same-origin',cache:'no-store'})
  if(!response.ok)throw Error('categories_unavailable')
  if(!response.body)throw Error('categories_unavailable')
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000){await reader.cancel();throw Error('categories_too_large')}parts.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  installSubjectCategories(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)).categories);lastLoaded=Date.now()
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(categories))}catch{/* No identity or private content stored. */}
 }finally{clearTimeout(timer)}})().finally(()=>{pending=undefined})
 return pending
}
