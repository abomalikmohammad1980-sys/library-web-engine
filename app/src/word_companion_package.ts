import {unzipSync} from 'fflate'
import type {WordPageMap} from './engine/library_store'
import {fingerprintBytes} from './word_import_authority'
import {wordMapImportFailure} from './word_import_diagnostic'

export interface WordCompanionPackage {source:Uint8Array;pdf:Uint8Array;map:WordPageMap;fileName:string}
const names=['manifest.json','source.docx','reference.pdf','pages.json']
/** Hash binding detects mismatched files, not a trusted attestation from Office. */
export async function readWordCompanionPackage(bytes:Uint8Array):Promise<WordCompanionPackage>{
 if(bytes.length>128*1024*1024)throw Error('حزمة Word تتجاوز الحد المسموح (128 ميجابايت)')
 let total=0;const seen=new Set<string>()
 const files=unzipSync(bytes,{filter(info){
  if(!names.includes(info.name)||seen.has(info.name))throw Error('بنية حزمة Word غير صحيحة')
  seen.add(info.name);total+=info.originalSize
  const limit=info.name==='manifest.json'?65536:info.name==='pages.json'?32*1024*1024:128*1024*1024
  if(info.originalSize>limit||total>256*1024*1024)throw Error('محتويات حزمة Word تتجاوز الحد المسموح')
  return true
 }})
 if(names.some(n=>!files[n]))throw Error('حزمة Word ناقصة؛ أعد إنشاءها بالأداة')
 const decode=(name:string)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files[name]!))
 const manifest=decode('manifest.json')
 if(manifest.contract!=='khizana-word-package/1'||manifest.platform!=='windows'||typeof manifest.fileName!=='string'||!manifest.fileName.toLowerCase().endsWith('.docx')||/[\\/\u0000-\u001f]/.test(manifest.fileName))throw Error('إصدار حزمة Word أو اسم الملف غير مدعوم')
 for(const name of names.slice(1))if(typeof manifest.sha256?.[name]!=='string'||await fingerprintBytes(files[name]!)!==manifest.sha256[name])throw Error('ملفات الحزمة غير متطابقة؛ أعد إنشاء الحزمة من الملف الأصلي')
 const map=decode('pages.json') as WordPageMap
 if(!Number.isSafeInteger(map.totalPages)||map.totalPages<1)throw Error('خريطة الصفحات غير صالحة')
 if(new TextDecoder().decode(files['reference.pdf']!.slice(0,5))!=='%PDF-')throw Error('النسخة المرجعية ليست PDF صالحًا')
 return {source:files['source.docx']!,pdf:files['reference.pdf']!,map,fileName:manifest.fileName}
}

export async function validateWordCompanionPackage(bundle:WordCompanionPackage):Promise<void>{
 const [{loadBookFromBuffer},{requireWordPageGroups},{assertConvertedPdfPageCardinality}]=await Promise.all([import('./engine/bridge'),import('./engine/dom_render'),import('./engine/word_pdf')])
 const model=loadBookFromBuffer(bundle.source).model
 try{requireWordPageGroups(model,bundle.map)}catch(error){throw wordMapImportFailure(error,model.paragraphs.length,bundle.map.paragraphs?.length??bundle.map.paragraphCount)}
 await assertConvertedPdfPageCardinality(bundle.pdf,bundle.map)
}
