import {h} from './ui'
export type WordImportProgress={stage:'sending'|'processing'|'receiving'|'validating';loaded?:number|undefined;total?:number|undefined}
export function measuredWordPercent(value:WordImportProgress):number|null{
 if(value.stage!=='receiving'||!Number.isSafeInteger(value.total)||value.total!<=0||!Number.isSafeInteger(value.loaded)||value.loaded!<0||value.loaded!>value.total!)return null
 return Math.floor(value.loaded!*100/value.total!)
}
export function wordImportProgressPanel(fileName:string){
 const label=h('p',{},''),meter=h('progress',{max:'100','aria-label':'نسبة استلام حزمة Word'}) as HTMLProgressElement
 meter.style.width='100%';meter.style.height='0.6rem';meter.style.accentColor='var(--accent, #2b745a)'
 const root=h('section',{class:'word-import-progress',role:'status','aria-live':'polite'},h('h3',{},fileName),label,meter)
 const update=(value:WordImportProgress)=>{
  const labels={sending:'جارٍ إرسال الملف إلى مساعد Word على جهازك',processing:'جارٍ تحويل المستند وإعداد صفحات Word',receiving:'جارٍ استلام الحزمة من مساعد Word',validating:'جارٍ التحقق من تطابق النص والصفحات'}
  const percent=measuredWordPercent(value);label.textContent=labels[value.stage]+(percent===null?'':` — ${percent}%`)
  meter.hidden=percent===null
  if(percent===null)meter.removeAttribute('value');else meter.value=percent
 }
 update({stage:'sending'});return {root,update}
}
