import {renderBoundUiTemplate,uiLabelParameter} from './ui_template_binding'
import {uiDictionary} from './ui_dictionary_loader'
const fields=['displayName','biography','source','reason','request','expectedVersion','fields'] as const
const reasons=['required','too_long','unsupported_markup','control_characters','invalid_type','private_source','invalid_request','invalid_date','date_order','invalid_text','invalid_list','unknown_field'] as const
export interface AuthorOverrideIssue {field:typeof fields[number];reason:typeof reasons[number];maxLength?:number;actualLength?:number;unit?:'bytes'|'utf16_code_units'}
export function parseAuthorOverrideIssue(value:unknown):AuthorOverrideIssue|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const row=value as Record<string,unknown>
 if(typeof row.field==='string'&&/^fields\.(birthHijri|birthGregorian|deathHijri|deathGregorian|birthPlace|deathPlace|fullName|lineage|knownAs|places|traits|categories|teachers|students|positions|works)$/.test(row.field))return parseAuthorOverrideIssue({...row,field:'fields'})
 if(!fields.includes(row.field as any)||!reasons.includes(row.reason as any))return null
 const issue:AuthorOverrideIssue={field:row.field as AuthorOverrideIssue['field'],reason:row.reason as AuthorOverrideIssue['reason']}
 for(const key of ['maxLength','actualLength'] as const)if(Number.isSafeInteger(row[key])&&Number(row[key])>=0&&Number(row[key])<=10000000)issue[key]=Number(row[key])
 if(row.unit==='bytes'||row.unit==='utf16_code_units')issue.unit=row.unit
 return issue
}
export function validateAuthorOverrideDraft(draft:{displayName:string;biography:string;source:string;reason:string;expectedVersion:number}):AuthorOverrideIssue|null{
 for(const [field,maxLength,required] of [['displayName',300,true],['biography',20000,false],['source',2000,false],['reason',1000,false]] as const){
  const value=draft[field]
  if(required&&!value.trim())return{field,reason:'required'}
  if(value.length>maxLength)return{field,reason:'too_long',maxLength,actualLength:value.length}
  if(/[<>]/u.test(value))return{field,reason:'unsupported_markup'}
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))return{field,reason:'control_characters'}
 }
 if(/file:|[A-Za-z]:\\|(?:^|\s)private\//i.test(draft.source))return{field:'source',reason:'private_source'}
 if(!Number.isSafeInteger(draft.expectedVersion)||draft.expectedVersion<0||draft.expectedVersion>=2147483647)return{field:'expectedVersion',reason:'invalid_request'}
 return null
}
export function authorOverrideIssueMessage(issue:AuthorOverrideIssue,language=typeof document==='undefined'?'ar':document.documentElement.lang||'ar'):string{
 const localized=(source:string)=>uiDictionary.translate(source,language)??source
 const label={displayName:'الاسم',biography:'الترجمة',source:'المصدر',reason:'سبب التعديل',request:'طلب الحفظ',expectedVersion:'نسخة الترجمة',fields:'حقول الترجمة'}[issue.field]
 if(issue.reason==='date_order')return localized('تاريخ الوفاة لا يمكن أن يسبق الميلاد في التقويم نفسه. لم تُفقد المسودة.')
 if(issue.reason==='invalid_date')return localized('أدخل السنة عددًا صحيحًا، أو اتركها فارغة إذا لم تُعرف. لم تُفقد المسودة.')
 if(issue.reason==='invalid_list')return localized('ضع كل اسم في سطر مستقل؛ الحد 50 سطرًا و300 حرف للسطر (500 للمؤلفات)، دون أكواد HTML. لم تُفقد المسودة.')
 if(issue.reason==='required')return renderBoundUiTemplate('c0e1bf85d04b57ae',{p1:uiLabelParameter(label)},language)
 if(issue.reason==='too_long')return renderBoundUiTemplate('0a207e4c99aaa637',{p1:uiLabelParameter(label),p2:issue.actualLength!==undefined&&issue.maxLength!==undefined?' '+renderBoundUiTemplate('2cb0abd15987fd1c',{p1:issue.actualLength.toLocaleString('ar'),p2:issue.maxLength.toLocaleString('ar'),p3:uiLabelParameter(issue.unit==='bytes'?'بايت':'حرف')},language):''},language)
 if(issue.reason==='unsupported_markup')return renderBoundUiTemplate('043af5f8d5256421',{p1:uiLabelParameter(label)},language)
 if(issue.reason==='control_characters')return renderBoundUiTemplate('3851043619d40f54',{p1:uiLabelParameter(label)},language)
 if(issue.reason==='private_source')return localized('المصدر يحتوي مسار ملف خاص؛ استخدم وصفًا أو رابطًا عامًا، أو اترك المصدر فارغًا.')
 if(issue.field==='expectedVersion')return localized('تعذّر التحقق من نسخة الترجمة. احتفظ بمسودتك واعرض النسخة الأحدث للمقارنة.')
 return renderBoundUiTemplate('9540b8cdfe15a529',{p1:uiLabelParameter(label)},language)
}
