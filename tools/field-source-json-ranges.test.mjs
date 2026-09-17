import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {fieldSourceRanges} from './field-source-json-ranges.mjs'
test('original UTF8 ranges preserve Arabic, escapes, nested controls and repeated values',()=>{
 const book={titles:[{pageSourceRowId:'p',title:'باب 😀 العلم'}],pages:[{sourceRowId:'p',sequence:3,body:'قول "العلم"\nسطر \\ جديد',foot:'نفس النص',inlineControls:[{body:'ليس متن الصفحة'}]},{sourceRowId:'q',body:'نفس النص',foot:null}]}
 const raw=Buffer.from(JSON.stringify(book,null,2)),rows=fieldSourceRanges(raw,'9',[['9:3'],['9:1']])
 assert.equal(rows.length,2)
 const texts=rows[0][1].map(([field,start,size,pin])=>{const part=raw.subarray(start,start+size);assert.equal(createHash('sha256').update(part).digest('hex'),pin);return[field,JSON.parse(part)]})
 assert.deepEqual(texts,[['title',book.titles[0].title],['body',book.pages[0].body],['foot',book.pages[0].foot]])
 assert.notEqual(rows[0][1][2][1],rows[1][1][0][1])
 assert.throws(()=>fieldSourceRanges(raw,'9',[]),/without_boundary/)
})
