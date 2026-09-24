import {jpegReadingPdf,jpegPagesReadingPdf,validateJpegSource,MAX_JPEG_BYTES} from './jpeg_pdf_source'

export type JpegImportMode='combined'|'separate'
/** The supplied order is the reviewed page order; never silently sort it again. */
export function jpegImportGroups(files:readonly File[],mode:JpegImportMode):File[][]{
  if(!files.length)throw Error('اختر صورة واحدة على الأقل')
  if(files.some(file=>!file.size||file.size>MAX_JPEG_BYTES||!/\.jpe?g$/iu.test(file.name)))throw Error('قائمة الصور تحتوي ملفًا غير صالح')
  if(mode==='separate')return files.map(file=>[file])
  if(mode!=='combined')throw Error('خيار تجميع الصور غير صالح')
  if(files.length>200||files.reduce((total,file)=>total+file.size,0)>64*1024*1024)throw Error('تجاوزت الصور حد الكتاب المجمّع')
  return [[...files]]
}

export interface JpegImportDraft {
  file:File
  /** Original bytes, never PDF bytes with a JPEG extension. */
  data:Uint8Array
  mimeType:'image/jpeg'
  title:string
  author:string
  readingPdf:Uint8Array
  readingPdfFileName:string
}

export interface JpegBookDraft {
  /** Reviewed order, including duplicate names. Names are not identities. */
  originals:Array<{file:File;data:Uint8Array;mimeType:'image/jpeg'}>
  title:string
  author:string
  readingPdf:Uint8Array
  readingPdfFileName:string
}

/** Prepare everything before any persistence; aborts never return a partial book. */
export async function prepareJpegBookDraft(files:readonly File[],author:string,options:{signal?:AbortSignal;convert?:typeof jpegPagesReadingPdf}={}):Promise<JpegBookDraft>{
  jpegImportGroups(files,'combined')
  const active=()=>options.signal?.throwIfAborted()
  active()
  const originals:JpegBookDraft['originals']=[]
  for(const file of files){
    active()
    const data=new Uint8Array(await file.arrayBuffer())
    active()
    validateJpegSource(data,file.name)
    originals.push({file,data,mimeType:'image/jpeg'})
  }
  const readingPdf=await (options.convert??jpegPagesReadingPdf)(originals.map(original=>({bytes:Uint8Array.from(original.data),fileName:original.file.name})))
  active()
  if(new TextDecoder().decode(readingPdf.subarray(0,5))!=='%PDF-')throw Error('تعذّر إنشاء نسخة القراءة PDF')
  const name=files[0]!.name
  return {originals,title:name.replace(/\.jpe?g$/iu,'').replace(/_+/g,' ').trim()||'كتاب مصور',author,readingPdf,readingPdfFileName:name.replace(/\.jpe?g$/iu,'.pdf')}
}

export async function prepareJpegImportDraft(file:File,author:string,convert=jpegReadingPdf):Promise<JpegImportDraft>{
  if(!file.size||file.size>MAX_JPEG_BYTES)throw Error('حجم صورة JPG غير مسموح')
  const data=new Uint8Array(await file.arrayBuffer())
  validateJpegSource(data,file.name)
  // The derivative receives its own buffer; converter code cannot mutate the original.
  const readingPdf=await convert(Uint8Array.from(data),file.name)
  if(new TextDecoder().decode(readingPdf.subarray(0,5))!=='%PDF-')throw Error('تعذّر إنشاء نسخة القراءة PDF')
  return {file,data,mimeType:'image/jpeg',title:file.name.replace(/\.jpe?g$/iu,'').replace(/_+/g,' ').trim()||'كتاب مصور',author,readingPdf,readingPdfFileName:file.name.replace(/\.jpe?g$/iu,'.pdf')}
}
