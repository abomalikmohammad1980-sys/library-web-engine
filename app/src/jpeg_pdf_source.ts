/** A JPEG remains the original; the PDF is only its lossless reading derivative. */
export const MAX_JPEG_BYTES = 32 * 1024 * 1024
export const MAX_JPEG_PIXELS = 40_000_000

/** Read only the orientation field in an APP1 TIFF directory; never follow arbitrary offsets. */
export function jpegOrientation(bytes:Uint8Array):number{
  let offset=2
  while(offset+4<=bytes.length&&bytes[offset]===255){
    while(bytes[offset]===255)offset++
    const marker=bytes[offset++]
    if(marker===0xda||marker===0xd9)break
    const length=(bytes[offset]!<<8)|bytes[offset+1]!
    if(length<2||offset+length>bytes.length)break
    const start=offset+2,end=offset+length
    if(marker===0xe1&&end-start>=14&&String.fromCharCode(...bytes.subarray(start,start+6))==='Exif\0\0'){
      const tiff=start+6,view=new DataView(bytes.buffer,bytes.byteOffset+tiff,end-tiff)
      const order=view.getUint16(0),little=order===0x4949
      if((!little&&order!==0x4d4d)||view.getUint16(2,little)!==42)return 1
      const directory=view.getUint32(4,little)
      if(directory<8||directory+2>view.byteLength)return 1
      const count=view.getUint16(directory,little)
      if(count>Math.floor((view.byteLength-directory-2)/12))return 1
      for(let i=0;i<count;i++){
        const entry=directory+2+i*12
        if(view.getUint16(entry,little)!==0x112)continue
        if(view.getUint16(entry+2,little)!==3||view.getUint32(entry+4,little)!==1)return 1
        const value=view.getUint16(entry+8,little)
        return value>=1&&value<=8?value:1
      }
    }
    offset=end
  }
  return 1
}

export function jpegPageTransform(width:number,height:number,orientation:number):[number,number,number,number,number,number]{
  switch(orientation){
    case 2:return[-1,0,0,1,width,0]
    case 3:return[-1,0,0,-1,width,height]
    case 4:return[1,0,0,-1,0,height]
    case 5:return[0,-1,-1,0,height,width]
    case 6:return[0,-1,1,0,0,width]
    case 7:return[0,1,1,0,0,0]
    case 8:return[0,1,-1,0,height,0]
    default:return[1,0,0,1,0,0]
  }
}

export function validateJpegSource(bytes:Uint8Array,fileName:string):{width:number;height:number}{
  if(!/\.jpe?g$/iu.test(fileName))throw Error('اختر صورة JPG أو JPEG')
  if(!bytes.length||bytes.length>MAX_JPEG_BYTES)throw Error('حجم صورة JPG يجب أن يكون بين بايت و32 ميجابايت')
  if(bytes[0]!==0xff||bytes[1]!==0xd8)throw Error('توقيع JPG غير صحيح')
  let offset=2
  while(offset<bytes.length){
    if(bytes[offset++]!==0xff)throw Error('بنية JPG غير صحيحة')
    while(bytes[offset]===0xff)offset++
    const marker=bytes[offset++]
    if(marker===0xd9||marker===0xda)break
    if(marker===0x01||(marker!>=0xd0&&marker!<=0xd7))continue
    if(offset+2>bytes.length)break
    const length=(bytes[offset]!<<8)|bytes[offset+1]!
    if(length<2||offset+length>bytes.length)throw Error('صورة JPG مبتورة')
    if(marker===0xc0||marker===0xc1||marker===0xc2){
      if(length<8)throw Error('رأس JPG غير صحيح')
      const height=(bytes[offset+3]!<<8)|bytes[offset+4]!,width=(bytes[offset+5]!<<8)|bytes[offset+6]!
      if(!width||!height||width*height>MAX_JPEG_PIXELS)throw Error('أبعاد JPG غير مسموحة (الحد40 مليون بكسل)')
      return {width,height}
    }
    offset+=length
  }
  throw Error('تعذّر قراءة أبعاد JPG')
}

export async function jpegReadingPdf(bytes:Uint8Array,fileName:string):Promise<Uint8Array>{
  return jpegPagesReadingPdf([{bytes,fileName}])
}

export async function jpegPagesReadingPdf(sources:ReadonlyArray<{bytes:Uint8Array;fileName:string}>):Promise<Uint8Array>{
  if(!sources.length||sources.length>200)throw Error('عدد صفحات الصور يجب أن يكون بين1 و200')
  if(sources.reduce((total,source)=>total+source.bytes.byteLength,0)>64*1024*1024)throw Error('حجم صور الكتاب يتجاوز64 ميجابايت')
  const dimensions=sources.map(source=>validateJpegSource(source.bytes,source.fileName))
  const {PDFDocument,concatTransformationMatrix,pushGraphicsState,popGraphicsState}=await import('pdf-lib')
  const pdf=await PDFDocument.create()
  // Stable derivative bytes make a retry of the same originals idempotent.
  pdf.setCreationDate(new Date(0));pdf.setModificationDate(new Date(0))
  for(let index=0;index<sources.length;index++){
  const {bytes}=sources[index]!,{width,height}=dimensions[index]!
  if(typeof createImageBitmap==='function'){
    const decoded=await createImageBitmap(new Blob([Uint8Array.from(bytes)],{type:'image/jpeg'}))
    decoded.close()
  }
  // embedJpg embeds the compressed source stream, without a canvas/re-encoding.
  const image=await pdf.embedJpg(Uint8Array.from(bytes))
  const scale=Math.min(1,14400/Math.max(width,height))
  const orientation=jpegOrientation(bytes),w=width*scale,h=height*scale
  const page=pdf.addPage(orientation>=5?[h,w]:[w,h])
  page.pushOperators(pushGraphicsState(),concatTransformationMatrix(...jpegPageTransform(w,h,orientation)))
  page.drawImage(image,{x:0,y:0,width:width*scale,height:height*scale})
  page.pushOperators(popGraphicsState())
  }
  return pdf.save()
}
