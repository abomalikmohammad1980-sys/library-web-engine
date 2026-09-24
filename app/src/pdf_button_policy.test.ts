import { describe, expect, it } from 'vitest'
import { ORIGINAL_PDF_MISSING_TOOLTIP, pdfButtonAction } from './pdf_button_policy'
const pdf=new Uint8Array([0x25,0x50,0x44,0x46,0x2d])

describe('PDF button policy',()=>{
  it.each(['shamela-bok','epub','html','markdown','text'])('uses formatted preview PDF for textual %s without an original',sourceFormat=>expect(pdfButtonAction({sourceFormat,fileName:`b.${sourceFormat}`},'standard')).toBe('formatted'))
  it('always prefers an attached original PDF',()=>expect(pdfButtonAction({sourceFormat:'epub',pdfData:pdf,pdfEngine:'manual-upload-v1'},'standard')).toBe('original'))
  it('keeps PDF+text original-only with the exact short tooltip',()=>{expect(pdfButtonAction({sourceFormat:'shamela-bok'},'pdf-text')).toBe('unavailable');expect(ORIGINAL_PDF_MISSING_TOOLTIP).toBe('ملف PDF الأصلي لم يُرفق مع هذا الكتاب')})
  it('does not mislabel a generated PDF as an original',()=>expect(pdfButtonAction({sourceFormat:'epub',pdfData:pdf,pdfEngine:'browser-scene-raster-v1'},'pdf-text')).toBe('unavailable'))
})
