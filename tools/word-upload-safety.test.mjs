import test from 'node:test'
import assert from 'node:assert/strict'
import {zipSync,strToU8} from 'fflate'
import {safeWordUpload} from '../deployment/cloudflare/functions/api/_word-upload-safety.js'
const document=(text='text',rel='')=>new File([zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<document>'+text+'</document>'),...(rel?{'word/_rels/document.xml.rels':strToU8('<Relationships>'+rel+'</Relationships>')}:{})},{level:0})],'fixture.docx')
const relation=(target,type='hyperlink')=>`<Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" TargetMode="External" Target="${target}"/>`
test('navigation mail links are permitted; external active resources remain rejected',async()=>{
 for(const target of ['https://example.test/','mailto:reader@example.test'])assert.equal(await safeWordUpload(document('text',relation(target))),true)
 for(const target of ['file:///c:/x','javascript:alert(1)','https://user:pass@example.test/'])assert.equal(await safeWordUpload(document('text',relation(target))),false)
 assert.equal(await safeWordUpload(document('text',relation('https://example.test/image','image'))),false)
})
test('large body XML is accepted without removing active XML rejection',async()=>{
 assert.equal(await safeWordUpload(document(' '.repeat(23*1024*1024))),true)
 for(const text of ['<!DOCTYPE x>','&#68;&#68;&#69;AUTO',' '.repeat(65523)+'&#68;&#68;&#69;AUTO'])assert.equal(await safeWordUpload(document(text)),false)
 assert.equal(await safeWordUpload(new File(['bad'],'fixture.docx')),false)
})
