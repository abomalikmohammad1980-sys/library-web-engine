export interface QuranNavigationRecord { ayahId:string; surah:number; ayah:number; page:number }
export interface QuranNavigationTarget { ayahId:string; surah:number; ayah:number; page:number }
export interface QuranNavigationIndex {
  pages: readonly QuranNavigationTarget[]
  juz: readonly QuranNavigationTarget[]
  hizb: readonly QuranNavigationTarget[]
  start: QuranNavigationTarget
}

/** بدايات الأجزاء في مصحف المدينة (604 صفحات). لا تتحول إلى هدف إلا بعد
 * مطابقتها بأول آية فعلية في الصفحة داخل page-map المنشور. */
export const MADINAH_JUZ_START_PAGES = [1,22,42,62,82,102,121,142,162,182,202,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582] as const

export function buildQuranNavigationIndex(records:readonly QuranNavigationRecord[]):QuranNavigationIndex {
  const byPage=new Map<number,QuranNavigationTarget>()
  for(const record of records){if(!byPage.has(record.page))byPage.set(record.page,{ayahId:record.ayahId,surah:record.surah,ayah:record.ayah,page:record.page})}
  const pages=Array.from({length:604},(_,index)=>byPage.get(index+1))
  if(pages.some(target=>!target))throw new Error('quran_navigation_page_map_incomplete')
  const completePages=pages as QuranNavigationTarget[]
  const juz=MADINAH_JUZ_START_PAGES.map(page=>completePages[page-1]!)
  const hizb=juz.flatMap((target,index)=>{
    const nextPage=MADINAH_JUZ_START_PAGES[index+1]??605
    const halfPage=target.page+Math.floor((nextPage-target.page)/2)
    return[target,completePages[halfPage-1]!]
  })
  return{pages:completePages,juz,hizb,start:completePages[0]!}
}

export function quranNavigationTarget(index:QuranNavigationIndex,kind:'start'|'page'|'juz'|'hizb',value=1):QuranNavigationTarget|undefined {
  if(kind==='start')return index.start
  const collection=kind==='page'?index.pages:kind==='juz'?index.juz:index.hizb
  return Number.isInteger(value)&&value>=1?collection[value-1]:undefined
}

export function readSavedQuranPosition(storage:Pick<Storage,'getItem'>):QuranNavigationTarget|undefined {
  try{const value=JSON.parse(storage.getItem('khizana-quran-position')??'null') as Partial<QuranNavigationTarget>|null
    return value&&typeof value.ayahId==='string'&&Number.isInteger(value.surah)&&Number.isInteger(value.ayah)&&Number.isInteger(value.page)?value as QuranNavigationTarget:undefined
  }catch{return undefined}
}
