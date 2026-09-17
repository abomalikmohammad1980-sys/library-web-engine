import test from 'node:test'
import assert from 'node:assert/strict'
import {percentile95,sampleSeoPaths} from './measure-seo-preview.mjs'
test('nearest rank p95 and reproducible unique public sample',()=>{
 assert.equal(percentile95(Array.from({length:30},(_,i)=>i+1)),29)
 const paths=Array.from({length:100},(_,i)=>'/books/'+(i+1)),sample=sampleSeoPaths([...paths,...paths,'/settings','/books/local/id'])
 assert.equal(sample.length,30);assert.equal(new Set(sample).size,30)
 assert.deepEqual(sample,sampleSeoPaths(paths));assert(sample.every(path=>/^\/books\/\d+$/.test(path)))
 assert.throws(()=>sampleSeoPaths(['/books/1']))
})
