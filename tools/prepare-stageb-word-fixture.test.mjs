import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {buildStageBWordFixture} from './prepare-stageb-word-fixture.mjs'
test('isolated synthetic Word plan has actual-parser verified map and immutable source hashes',async()=>{
 const f=await buildStageBWordFixture();assert.equal(f.plan.id,'codex-stageb-word');assert.equal(f.objects.length,2)
 for(const o of f.objects)assert.equal(f.plan.objects.find(p=>p.key===o.key).sha256,createHash('sha256').update(o.bytes).digest('hex'))
 assert.match(f.sql,/INSERT INTO user_book_word_bundles/);assert.equal(f.plan.bok.status,'not_prepared')
 assert.equal(f.plan.isolated.bucket,'khizana-ingestion-acceptance-20260917')
})
