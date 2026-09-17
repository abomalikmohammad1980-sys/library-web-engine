import {h} from './ui'
export type WordImportProgress={stage:'sending'|'processing'|'receiving'|'validating';loaded?:number|undefined;total?:number|undefined}
export function measuredWordPercent(value:WordImportProgress):number|null{
 if(value.stage!=='receiving'||!Number.isSafeInteger(value.total)||value.total!<=0||!Number.isSafeInteger(value.loaded)||value.loaded!<0||value.loaded!>value.total!)return null
 return Math.floor(value.loaded!*100/value.total!)
}
export function wordImportProgressPanel(fileName:string){
 const label=h('p',{},''),detail=h('p',{class:'muted'},''),meter=h('progress',{max:'100','aria-label':'تقدّم تجهيز Word'}) as HTMLProgressElement
 meter.style.width='100%';meter.style.height='0.6rem';meter.style.accentColor='var(--accent, #2b745a)'
 const root=h('section',{class:'import-review',role:'status','aria-live':'polite'},h('h3',{},fileName),label,meter,detail)
 root.style.padding='1rem';root.style.borderRadius='1rem';root.style.border='1px solid var(--border, #ddd5c7)'
 const update=(value:WordImportProgress)=>{
  const labels={sending:'جارٍ إرسال الملف إلى مساعد Word على جهازك',processing:'جارٍ تحويل المستند وإعداد صفحات Word',receiving:'جارٍ استلام الحزمة من مساعد Word',validating:'جارٍ التحقق من تطابق النص والصفحات'}
  const percent=measuredWordPercent(value);label.textContent=labels[value.stage]+(percent===null?'':` — ${percent}%`)
  if(percent===null)meter.removeAttribute('value');else meter.value=percent
  detail.textContent=value.stage==='processing'?'المساعد لا يوفّر نسبة تحويل مقاسة؛ ستظهر نسبة الاستلام عند توفر حجم الحزمة.':'تجهيز محلي قبل المراجعة؛ لم يُنشر الكتاب أو يُرفع إلى الحساب.'
 }
 update({stage:'sending'});return {root,update}
}
