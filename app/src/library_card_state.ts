export interface CardAssetBook {
  data?: Uint8Array
  sourceData?: Uint8Array
  fileName?: string
  mimeType?: string
  sourceMimeType?: string
  sourceFormat?: string
}

export interface LocalOriginalAsset { bytes: Uint8Array; fileName: string; mimeType: string }

/**
 * حقيقة محلية فقط. حزمة الشاملة المنشورة JSON مشتقة للقراءة وليست ملف BOK؛
 * لا نعيد تسميتها إلى bok ولا نعرض زر «الأصل» إلا لبايتات أصلية مثبتة.
 */
export function localOriginalAsset(book: CardAssetBook): LocalOriginalAsset | undefined {
  const bytes=(book.sourceData?.byteLength??0)>0?book.sourceData:(book.data?.byteLength??0)>0?book.data:undefined
  if(!bytes)return
  let fileName=book.fileName?.trim()||'book.bin',mimeType=(book.sourceData?book.sourceMimeType:book.mimeType)||'application/octet-stream'
  if(book.sourceFormat==='shamela-bok'){
    const signature=new TextDecoder('latin1').decode(bytes.subarray(4,19))
    if(signature!=='Standard Jet DB')return
    if(!/\.bok$/iu.test(fileName))fileName=`${fileName.replace(/(?:\.catalog)?\.json$|\.[^.]+$/iu,'')||'book'}.bok`
    mimeType='application/x-shamela-bok'
  }
  return{bytes,fileName,mimeType}
}

/** حقيقة محلية فقط: لا نزعم وجود الأصل إن لم تكن بايتاته محفوظة. */
export function hasLocalOriginalAsset(book: CardAssetBook): boolean {
  return Boolean(localOriginalAsset(book))
}
