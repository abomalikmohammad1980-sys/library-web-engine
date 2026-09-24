import assert from 'node:assert/strict'
import test from 'node:test'
import {validJpegSource} from '../functions/api/_jpeg-source.js'
import {intakeExtras} from '../functions/api/_book-intake.js'

// Header fixtures test bounded inspection, not full JPEG decoding.
const jpeg=(w=300,h=420)=>new File([Uint8Array.from([255,216,255,192,0,11,8,h>>8,h&255,w>>8,w&255,1,1,17,0,255,217])],'page.jpg',{type:'image/jpeg'})
const form=()=>{const f=new FormData();f.set('file',jpeg());return f}
test('JPEG inspection rejects invalid signatures, truncated segments and oversized pixel dimensions',async()=>{
 assert.equal(await validJpegSource(jpeg()),true)
 assert.equal(await validJpegSource(jpeg(0,1)),false)
 assert.equal(await validJpegSource(jpeg(65535,65535)),false)
 assert.equal(await validJpegSource(new File(['<html>'],'fake.jpg')),false)
 assert.equal(await validJpegSource(jpeg().slice(0,10)),false)
})
test('ordered image source intake preserves all 200 pages without relaxing Word limits',async()=>{
 const f=form();for(let n=1;n<=199;n++)f.set(`volumeFile:${n}`,jpeg())
 const parsed=await intakeExtras(f,async file=>await validJpegSource(file)?'image/jpeg':null)
 assert.equal(parsed.assets.length,199);assert.deepEqual(parsed.assets.map(a=>a.partNumber),Array.from({length:199},(_,n)=>n+2))
 f.set('volumeFile:200',jpeg());await assert.rejects(()=>intakeExtras(f,async()=> 'image/jpeg'),/invalid_book_metadata/)
 const word=form();word.set('file',new File(['test'],'book.docx'));word.set('volumeFile:21',jpeg())
 await assert.rejects(()=>intakeExtras(word,async()=> 'image/jpeg'),/invalid_book_metadata/)
})
test('image intake rejects gaps, duplicate fields and non-image pages',async()=>{
 const gap=form();gap.set('volumeFile:2',jpeg());await assert.rejects(()=>intakeExtras(gap,async()=> 'image/jpeg'),/invalid_book_metadata/)
 const duplicate=form();duplicate.append('file',jpeg());await assert.rejects(()=>intakeExtras(duplicate,async()=> 'image/jpeg'),/invalid_book_metadata/)
 const mixed=form();mixed.set('volumeFile:1',new File(['%PDF-1.7'],'page.pdf'));await assert.rejects(()=>intakeExtras(mixed,async()=> 'application/pdf'),/invalid_book_type/)
})
