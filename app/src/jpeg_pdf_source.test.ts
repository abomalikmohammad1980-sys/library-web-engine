import {describe,it,expect} from 'vitest'
import {validateJpegSource,MAX_JPEG_BYTES,jpegOrientation,jpegPageTransform,jpegPagesReadingPdf} from './jpeg_pdf_source'

// Header-only fixtures exercise validation, not image decoding or visual acceptance.
const header=(width:number,height:number)=>new Uint8Array([255,216,255,192,0,11,8,height>>8,height&255,width>>8,width&255,1,1,17,0,255,217])
describe('bounded original JPEG intake',()=>{
  it('creates stable derivative bytes for retry identity (not a decoding acceptance)',async()=>{
    const sources=[{bytes:header(12,18),fileName:'one.jpg'},{bytes:header(18,12),fileName:'two.jpg'}]
    const first=await jpegPagesReadingPdf(sources),second=await jpegPagesReadingPdf(sources)
    expect(first).toEqual(second)
    const {PDFDocument}=await import('pdf-lib')
    expect((await PDFDocument.load(first)).getPageCount()).toBe(2)
  })
  it('reads EXIF in both byte orders and ignores malformed offsets',()=>{
    for(const little of [true,false])for(let orientation=1;orientation<=8;orientation++){
      const bytes=new Uint8Array(38),view=new DataView(bytes.buffer)
      bytes.set([255,216,255,225,0,34,69,120,105,102,0,0]);view.setUint16(12,little?0x4949:0x4d4d)
      view.setUint16(14,42,little);view.setUint32(16,8,little);view.setUint16(20,1,little)
      view.setUint16(22,0x112,little);view.setUint16(24,3,little);view.setUint32(26,1,little);view.setUint16(30,orientation,little)
      expect(jpegOrientation(bytes)).toBe(orientation)
      view.setUint32(16,0xffffffff,little);expect(jpegOrientation(bytes)).toBe(1)
    }
  })
  it('keeps every rotated or mirrored corner inside the oriented page',()=>{
    for(let orientation=1;orientation<=8;orientation++){
      const [a,b,c,d,e,f]=jpegPageTransform(120,180,orientation)
      const corners=[[0,0],[120,0],[0,180],[120,180]].map(([x,y])=>[a*x!+c*y!+e,b*x!+d*y!+f])
      expect(Math.min(...corners.map(p=>p[0]!))).toBe(0);expect(Math.min(...corners.map(p=>p[1]!))).toBe(0)
      expect(Math.max(...corners.map(p=>p[0]!))).toBe(orientation>=5?180:120)
      expect(Math.max(...corners.map(p=>p[1]!))).toBe(orientation>=5?120:180)
    }
    expect(jpegPageTransform(120,180,6)).toEqual([0,-1,1,0,0,120])
  })
  it('recognizes JPEG dimensions without decoding or altering source bytes',()=>{
    const bytes=header(1200,1800),before=Uint8Array.from(bytes)
    expect(validateJpegSource(bytes,'صفحة.JPEG')).toEqual({width:1200,height:1800})
    expect(bytes).toEqual(before)
  })
  it('rejects misleading extensions, signatures and truncated marker payloads',()=>{
    expect(()=>validateJpegSource(header(1,1),'a.png')).toThrow()
    expect(()=>validateJpegSource(new TextEncoder().encode('<html>'),'a.jpg')).toThrow('توقيع')
    expect(()=>validateJpegSource(header(1,1).slice(0,10),'a.jpg')).toThrow('مبتورة')
  })
  it('bounds bytes and decompressed pixel dimensions before PDF work',()=>{
    expect(()=>validateJpegSource(new Uint8Array(MAX_JPEG_BYTES+1),'a.jpg')).toThrow('حجم')
    expect(()=>validateJpegSource(header(65535,65535),'a.jpg')).toThrow('أبعاد')
    expect(()=>validateJpegSource(header(0,12),'a.jpg')).toThrow('أبعاد')
  })
})
