/** Explicit source-ID bindings: never infer a template from a book/user string. */
import {EN_ACCOUNT_TEMPLATES_REVIEWED} from './i18n/en.account_templates.reviewed'
import {EN_READING_TEMPLATES_REVIEWED} from './i18n/en.reading_templates.reviewed'
import {EN_AUDIENCE_TEMPLATES_REVIEWED} from './i18n/en.audience_templates.reviewed'
import {EN_HOME_BOOK_TEMPLATES_REVIEWED} from './i18n/en.home_book_templates.reviewed'
import {EN_INTERFACE_TEMPLATES_REVIEWED} from './i18n/en.interface_templates.reviewed'
import {EN_SHELF_TEMPLATES_REVIEWED} from './i18n/en.shelf_templates.reviewed'
import {EN_QURAN_TEMPLATES_REVIEWED} from './i18n/en.quran_templates.reviewed'
import {EN_HOME_REMAINING_TEMPLATES_REVIEWED} from './i18n/en.home_remaining_templates.reviewed'
import {EN_REPORT_TEMPLATES_REVIEWED} from './i18n/en.report_templates.reviewed'
import {EN_SEARCH_REPAIR_TEMPLATES_REVIEWED} from './i18n/en.search_repair_templates.reviewed'
import {EN_ADMIN_PUBLISHED_TEMPLATES_REVIEWED} from './i18n/en.admin_published_templates.reviewed'
import {EN_BOK_EDITOR_TEMPLATES_REVIEWED} from './i18n/en.bok_editor_templates.reviewed'
import {EN_IMPORT_REVIEW_TEMPLATES_REVIEWED} from './i18n/en.import_review_templates.reviewed'
import {EN_SEARCH_RESULTS_TEMPLATES_REVIEWED} from './i18n/en.search_results_templates.reviewed'
import {EN_SUNNAH_SOURCE_TEMPLATES_REVIEWED} from './i18n/en.sunnah_source_templates.reviewed'
import {uiDictionary} from './ui_dictionary_loader'
const templates:Readonly<Record<string,{source:string;translations:Readonly<Record<string,string>>}>>={
 ...EN_ACCOUNT_TEMPLATES_REVIEWED,
 ...EN_READING_TEMPLATES_REVIEWED,
 ...EN_AUDIENCE_TEMPLATES_REVIEWED,
 ...EN_HOME_BOOK_TEMPLATES_REVIEWED,
 ...EN_INTERFACE_TEMPLATES_REVIEWED,
 ...EN_SHELF_TEMPLATES_REVIEWED,
 ...EN_QURAN_TEMPLATES_REVIEWED,
 ...EN_HOME_REMAINING_TEMPLATES_REVIEWED,
 ...EN_REPORT_TEMPLATES_REVIEWED,
 ...EN_SEARCH_REPAIR_TEMPLATES_REVIEWED,
 ...EN_ADMIN_PUBLISHED_TEMPLATES_REVIEWED,
 ...EN_BOK_EDITOR_TEMPLATES_REVIEWED,
 ...EN_IMPORT_REVIEW_TEMPLATES_REVIEWED,
 ...EN_SEARCH_RESULTS_TEMPLATES_REVIEWED,
 ...EN_SUNNAH_SOURCE_TEMPLATES_REVIEWED,
}
interface UiLabelParameter {readonly type:'ui-label';readonly source:string}
interface UiRegionParameter {readonly type:'ui-region';readonly code:string}
interface UiDateParameter {readonly type:'ui-date';readonly value:string;readonly options:Readonly<Intl.DateTimeFormatOptions>}
interface UiNumberParameter {readonly type:'ui-number';readonly value:number;readonly options:Readonly<Intl.NumberFormatOptions>}
type Parameters=Readonly<Record<string,string|number|UiLabelParameter|UiRegionParameter|UiDateParameter|UiNumberParameter>>
/** Call only with an owned UI label, never a stored name, quote or book field. */
export function uiLabelParameter(source:string):UiLabelParameter{return Object.freeze({type:'ui-label',source})}
export function uiRegionParameter(code:string):UiRegionParameter{return Object.freeze({type:'ui-region',code})}
export function uiDateParameter(value:string,options:Intl.DateTimeFormatOptions={}):UiDateParameter{return Object.freeze({type:'ui-date',value,options:Object.freeze({...options})})}
export function uiNumberParameter(value:number,options:Intl.NumberFormatOptions={}):UiNumberParameter{return Object.freeze({type:'ui-number',value,options:Object.freeze({...options})})}
const bindings=new WeakMap<Text,{id:string;parameters:Parameters}>()
type TemplateAttribute='aria-label'|'title'|'placeholder'|'alt'|'data-ui-busy-label'|'data-tooltip'
const attributeBindings=new WeakMap<Element,Map<string,{id:string;parameters:Parameters}>>()

export function renderBoundUiTemplate(id:string,parameters:Parameters,language:string):string{
 const template=templates[id]
 if(!template)throw new Error(`Unknown UI template: ${id}`)
 const text=template.translations[language]??template.source
 return fillTemplate(text,parameters,language)
}
function fillTemplate(text:string,parameters:Parameters,language:string):string{
 return text.replace(/\{(p\d+)\}/g,(_,key:string)=>{
  if(!Object.prototype.hasOwnProperty.call(parameters,key))throw new Error(`Missing UI parameter: ${key}`)
  // A callback replacement preserves $&, braces and arbitrary text verbatim.
  const value=parameters[key]
  if(typeof value==='object'){
   if(value.type==='ui-label')return language==='ar'?value.source:uiDictionary.translate(value.source,language)??value.source
   if(value.type==='ui-region'){try{return new Intl.DisplayNames([language],{type:'region'}).of(value.code)??value.code}catch{return value.code}}
   if(value.type==='ui-number')return Number.isFinite(value.value)?new Intl.NumberFormat(language,value.options).format(value.value):String(value.value)
   const date=new Date(value.value)
   return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(language,value.options).format(date):value.value
  }
  return typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat(language,{useGrouping:false}).format(value):String(value)
 })
}

export function uiTemplateText(id:string,parameters:Parameters):Text{
 const snapshot={...parameters}
 const node=document.createTextNode(renderBoundUiTemplate(id,snapshot,'ar'))
 bindings.set(node,{id,parameters:snapshot})
 return node
}

export function boundUiText(node:Text,language:string):string|undefined{
 const binding=bindings.get(node)
 if(!binding)return undefined
 // Keep existing locale resolvers until that language receives explicit reviewed bindings.
 if(language!=='ar'&&!templates[binding.id]?.translations[language])return legacyBoundText(binding.id,binding.parameters,language)
 return renderBoundUiTemplate(binding.id,binding.parameters,language)
}

/** Own only this UI attribute; input values and surrounding protected content stay untouched. */
export function uiTemplateAttribute(element:Element,name:TemplateAttribute,id:string,parameters:Parameters):void{
 const snapshot={...parameters}
 const source=renderBoundUiTemplate(id,snapshot,'ar')
 const entries=attributeBindings.get(element)??new Map()
 entries.set(name,{id,parameters:snapshot});attributeBindings.set(element,entries)
 element.setAttribute(name,source)
}

export function boundUiAttribute(element:Element,name:string,language:string):string|undefined{
 const binding=attributeBindings.get(element)?.get(name)
 if(!binding)return undefined
 if(language!=='ar'&&!templates[binding.id]?.translations[language])return legacyBoundText(binding.id,binding.parameters,language)
 return renderBoundUiTemplate(binding.id,binding.parameters,language)
}

function legacyBoundText(id:string,parameters:Parameters,language:string):string|undefined{
 // Ask the old dictionary only about the owned template, before substituting data.
 const template=templates[id]
 if(!template)return undefined
 const source=template.source,translated=uiDictionary.translate(source,language)
 if(!translated)return undefined
 const slots=(text:string)=>JSON.stringify((text.match(/\{p\d+\}/g)??[]).sort())
 if(slots(source)!==slots(translated))return undefined
 return fillTemplate(translated,parameters,language)
}
