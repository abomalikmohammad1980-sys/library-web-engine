import {it,expect} from 'vitest'
import {zipSync,strToU8} from 'fflate'
import {extractFromDocx} from './index'
function parse(body:string){return extractFromDocx(zipSync({'word/document.xml':strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${body}</w:p></w:body></w:document>`)})).paragraphs[0]!}
it('preserves nested legacy smart-tag text, order and run formatting without displaying metadata',()=>{
 const p=parse('<w:r><w:t>قبل </w:t></w:r><w:smartTag w:element="place"><w:smartTagPr><w:attr w:name="hidden-metadata" w:val="not text"/></w:smartTagPr><w:smartTag w:element="city"><w:r><w:rPr><w:b/></w:rPr><w:t>المدينة</w:t></w:r></w:smartTag><w:r><w:t> 42</w:t></w:r></w:smartTag><w:r><w:t> بعد</w:t></w:r>')
 expect(p.text).toBe('قبل المدينة 42 بعد');expect(p.runs.find(r=>r.text==='المدينة')?.bold).toBe(true)
 expect(p.excluded).toBe(false)
})
it('retains inherited hyperlink and cached field semantics through smart tags',()=>{
 const p=parse('<w:hyperlink w:anchor="chapter"><w:smartTag><w:r><w:t>رابط</w:t></w:r></w:smartTag></w:hyperlink><w:fldSimple w:instr=" PAGE "><w:smartTag><w:r><w:t>7</w:t></w:r></w:smartTag></w:fldSimple>')
 expect(p.text).toBe('رابط7');expect(p.runs[0]?.href).toBe('chapter');expect(p.runs[1]?.fieldResult).toBe('PAGE')
})
