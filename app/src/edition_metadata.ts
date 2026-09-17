import type { EditionBook } from './edition_groups'

export interface EditionMetadataEvidence { field:'publisher'|'investigator'|'edition'|'publicationYearHijri'|'volumeCount'; value:string|number; provenance:'rawSourceMetadata'|'title'; confidence:'high' }
export interface ExtractedEditionMetadata { values:Partial<Pick<EditionBook,'publisher'|'investigator'|'edition'|'publicationYearHijri'|'volumeCount'>>; evidence:EditionMetadataEvidence[] }

const clean=(value:string)=>value.normalize('NFKC').replace(/\s+/gu,' ').trim()
const specs=[
  ['publisher','(?:الناشر|دار النشر)','[^\\r\\n]+'],
  ['investigator','(?:المحقق|تحقيق)','[^\\r\\n]+'],
  ['edition','(?:الطبعة)','[^\\r\\n]+'],
  ['publicationYearHijri','(?:سنة النشر|عام النشر)','[0-9٠-٩]{3,4}(?:\\s*هـ)?'],
  ['volumeCount','(?:عدد الأجزاء|الأجزاء)','[0-9٠-٩]{1,3}'],
] as const
const arabicDigits=(value:string)=>Number(value.replace(/[٠-٩]/gu,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/gu,''))

/** Exact labelled lines only; ambiguous or repeated conflicting values fail closed. */
export function extractEditionMetadata(raw?:string):ExtractedEditionMetadata{
  const values:ExtractedEditionMetadata['values']={},evidence:EditionMetadataEvidence[]=[]
  if(!raw)return{values,evidence}
  let structured:Record<string,unknown>={}
  try{const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))structured=parsed as Record<string,unknown>}catch{}
  for(const [field,label,valuePattern] of specs){
    const re=new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*[:：]\\s*(${valuePattern})\\s*(?=\\n|$)`,'giu')
    const found=[...raw.matchAll(re)].map(match=>clean(match[1]??'')).filter(Boolean)
    const direct=structured[field]
    if(typeof direct==='string'||typeof direct==='number')found.push(clean(String(direct)))
    const unique=[...new Set(found)]
    if(unique.length!==1)continue
    const value=field==='publicationYearHijri'||field==='volumeCount'?arabicDigits(unique[0]!):unique[0]!
    if((typeof value==='number'&&(!Number.isFinite(value)||value<=0))||value==='')continue
    ;(values as Record<string,unknown>)[field]=value
    evidence.push({field,value,provenance:'rawSourceMetadata',confidence:'high'})
  }
  return{values,evidence}
}

export function withExtractedEditionMetadata<T extends EditionBook&{rawSourceMetadata?:string;parts?:unknown[];bokPages?:unknown[]}>(book:T):T&{editionMetadataEvidence:EditionMetadataEvidence[]}{
  const extracted=extractEditionMetadata(book.rawSourceMetadata)
  const suffix=/\s+[\-–—]\s+(ط|ت|طبعة|تحقيق|دار)\s+(.+)$/u.exec(book.title.normalize('NFKC').trim())
  const titleValues:Partial<EditionBook>={},titleEvidence:EditionMetadataEvidence[]=[]
  if(suffix){const field=suffix[1]==='ت'||suffix[1]==='تحقيق'?'investigator':suffix[1]==='دار'?'publisher':'edition',value=clean(suffix[2]??'');if(value){titleValues[field]=value;titleEvidence.push({field,value,provenance:'title',confidence:'high'})}}
  return{...book,...Object.fromEntries(Object.entries(extracted.values).filter(([key])=>(book as Record<string,unknown>)[key]==null)),...Object.fromEntries(Object.entries(titleValues).filter(([key])=>(book as Record<string,unknown>)[key]==null)),volumeCount:book.volumeCount??book.parts?.length??extracted.values.volumeCount,physicalPageCount:book.physicalPageCount??book.readerPageCount??book.bokPages?.length,printSource:book.printSource??extracted.values.publisher,editionMetadataEvidence:[...extracted.evidence,...titleEvidence]}
}


