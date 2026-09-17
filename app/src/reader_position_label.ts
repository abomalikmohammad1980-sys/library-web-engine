import {uiTemplateText} from './ui_template_binding'
const arabicDigits = '٠١٢٣٤٥٦٧٨٩'

export function readerPositionPercent(current: number, total: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)))
}

const digits = (value: number | string): string => String(value).replace(/\d/g, digit => arabicDigits[Number(digit)]!)

/** Physical sheet navigation is distinct from a section's printed PAGE label. */
export function readerWordSheetPosition(index:number,total:number,printed:number|string){
 return {current:index+1,total,printedHint:String(printed)!==String(index+1)?`رقم الصفحة في ترقيم الكتاب: ${digits(printed)}`:''}
}

/** الصياغة الوحيدة لشارة الموضع في Word/PDF/EPUB/BOK/text. */
export function readerPositionLabel(current: number | string, total?: number, percent?: number): string {
  if (!total || total <= 0) return `صفحة ${digits(current)}`
  const resolved = percent == null ? readerPositionPercent(Number(current), total) : Math.max(0, Math.min(100, Math.round(percent)))
  return `صفحة ${digits(current)} من ${digits(total)} - بلغت ${digits(resolved)}٪ منه`
}

/** Display binding only: navigation indices and percentage semantics are unchanged. */
export function readerPositionBinding(current:number|string,total?:number,percent?:number):{id:string;parameters:Record<string,string|number>}{
  const page=typeof current==='number'||(/^\d+$/.test(current)&&String(Number(current))===current)?Number(current):digits(current)
  if(!total||total<=0)return{id:'e95fdd861149fc31',parameters:{p1:page}}
  const resolved=percent==null?readerPositionPercent(Number(current),total):Math.max(0,Math.min(100,Math.round(percent)))
  return{id:'2889e8ac6a00a75c',parameters:{p1:page,p2:total,p3:resolved}}
}
export function readerPositionText(current:number|string,total?:number,percent?:number):Text{
  const binding=readerPositionBinding(current,total,percent)
  return uiTemplateText(binding.id,binding.parameters)
}
