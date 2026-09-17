import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {createHash} from 'node:crypto'
import {visibleSeoListingRows} from '../alpha-publish/functions/_seo-listings.js'
import {loadSeoDataRelease} from '../alpha-publish/functions/_seo-data-release.js'
import {buildSeoListings} from './build-seo-listings.mjs'
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE central_book_overrides(book_id TEXT PRIMARY KEY,visibility TEXT,logically_deleted_at TEXT,title TEXT,author TEXT,category TEXT,updated_at TEXT,revision INTEGER)')
 let calls=0,sessions=0
 const db={prepare:statement=>({bind:(...args)=>({all:async()=>{calls++;assert.equal(args.length,1);return{results:sql.prepare(statement).all(...args)}}})}),withSession(mode){assert.equal(mode,'first-primary');sessions++;return db}}
 return{db,sql,get calls(){return calls},get sessions(){return sessions}}
}
test('real SQLite json_each handles full100 rows, aliases and deletion with one statement',async()=>{
 const f=database(),rows=Array.from({length:100},(_,i)=>({kind:'book',id:String(i+1)}))
 f.sql.exec("INSERT INTO central_book_overrides(book_id,visibility,logically_deleted_at) VALUES('1','private',NULL),('410000002','private',NULL),('shamela-3','public','today'),('4','public',NULL),('shamela-4','private',NULL)")
 const result=await visibleSeoListingRows(f.db,rows)
 assert.equal(result.length,96);assert.deepEqual(result.slice(0,2).map(r=>r.id),['5','6']);assert.equal(f.calls,1)
 f.sql.close()
})
test('immutable raw read is coalesced per request, but fresh visibility catches withdrawal between calls',async()=>{
 const f=database(),built=buildSeoListings({generatedAt:'2026-09-17T00:00:00Z',authors:[{id:'000020',name:'اسم'}],books:[{id:'1',title:'عنوان',authorId:'000020'}]})
 const bytes=Buffer.from(JSON.stringify({contract:'seo-data-release/1',identities:{},listings:{releaseId:built.report.releaseId}})),sha=createHash('sha256').update(bytes).digest('hex')
 let gets=0
 const env={SEO_DATA_RELEASE_SHA256:sha,ASSETS:{fetch:async()=>new Response(bytes)},VISITORS_DB:f.db,LIBRARY_R2:{get:async key=>{gets++;const value=built.files.get(key.split('/').at(-1));return value?{size:value.length,body:new Response(value).body}:null}}}
 const release=await loadSeoDataRelease(env,'https://preview.test')
 const first=await Promise.all([release.listing('browse',1),release.listing('browse',1)])
 assert.equal(gets,1);assert.equal(first[0].rows.length,1);assert.equal(f.sessions,2);assert.equal(f.calls,2)
 f.sql.exec("INSERT INTO central_book_overrides(book_id,visibility,logically_deleted_at) VALUES('shamela-1','private',NULL)")
 assert.equal((await release.listing('browse',1)).rows.length,0);assert.equal(gets,1);assert.equal(f.sessions,3)
 const another=await loadSeoDataRelease(env,'https://preview.test');assert.equal((await another.listing('browse',1)).rows.length,0);assert.equal(gets,2)
 f.sql.close()
})
test('newest public alias edits labels and cache dependency metadata; category moves exclude stale links',async()=>{
 const f=database(),rows=[{kind:'book',id:'1',title:'old',href:'/books/1'}]
 f.sql.exec("INSERT INTO central_book_overrides VALUES('1','public',NULL,'older','author','old-category','date1',1),('shamela-1','public',NULL,'new title','new author','new-category','date2',2)")
 const current=await visibleSeoListingRows(f.db,rows)
 assert.equal(current[0].title,'new title');assert.equal(current[0].author,'new author');assert.equal(current[0].updatedAt,'date2')
 assert.equal((await visibleSeoListingRows(f.db,rows,{list:'category:old-category'})).length,0)
 assert.equal((await visibleSeoListingRows(f.db,rows,{list:'category:new-category'})).length,1)
 assert.equal(rows[0].title,'old');f.sql.close()
})
