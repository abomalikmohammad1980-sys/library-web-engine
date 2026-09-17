import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {cachedSeoImmutable} from '../alpha-publish/functions/_seo-immutable-cache.js'
import {loadSeoDataRelease} from '../alpha-publish/functions/_seo-data-release.js'
import {buildSeoListings} from './build-seo-listings.mjs'
import {buildSeoIdentities} from './build-seo-identities.mjs'
const release='a'.repeat(64)
function memory(){const rows=new Map();return{rows,match:async req=>rows.get(req.url)?.clone(),put:async(req,response)=>{rows.set(req.url,response.clone())},delete:async req=>rows.delete(req.url)}}
test('internal immutable cache validates bounds/checksum, isolates versions, and tolerates no Cache API',async()=>{
 const cache=memory();let loads=0;const load=async()=>{loads++;return{title:'عنوان'}}
 await cachedSeoImmutable({cache,release,key:'one',load});await cachedSeoImmutable({cache,release,key:'one',load});assert.equal(loads,1)
 const key=[...cache.rows.keys()][0];assert(key.includes('/__internal/seo-immutable/'));assert.equal(cache.rows.get(key).headers.get('cache-control'),'public, max-age=86400')
 cache.rows.set(key,new Response('{"title":"wrong"}',{headers:{'x-seo-body-sha256':'0'.repeat(64)}}))
 assert.equal((await cachedSeoImmutable({cache,release,key:'one',load})).title,'عنوان');assert.equal(loads,2)
 await cachedSeoImmutable({cache,release:'b'.repeat(64),key:'one',load});assert.equal(loads,3)
 await cachedSeoImmutable({release,key:'one',load});assert.equal(loads,4)
 await assert.rejects(cachedSeoImmutable({cache,release,key:'huge',load:async()=>({text:'x'.repeat(200000)})}),/size/)
})
test('separate HTTP release instances skip R2 on cache hit but fresh primary withdrawal and edits remain effective',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE central_book_overrides(book_id TEXT PRIMARY KEY,title TEXT,author TEXT,category TEXT,visibility TEXT,logically_deleted_at TEXT,updated_at TEXT,revision INTEGER)')
 let sessions=0,queries=0,reads=0
 const db={withSession(mode){assert.equal(mode,'first-primary');sessions++;return db},prepare(query){return{bind:(...args)=>({all:async()=>{queries++;return{results:sql.prepare(query).all(...args)}}})}}}
 const listing=buildSeoListings({generatedAt:'2026-09-17T00:00:00Z',authors:[{id:'000020',name:'مؤلف'}],books:[{id:'1',title:'كتاب',authorId:'000020'}]})
 const bytes=Buffer.from(JSON.stringify({contract:'seo-data-release/1',identities:{},listings:{releaseId:listing.report.releaseId}})),sha=createHash('sha256').update(bytes).digest('hex'),cache=memory()
 const env={SEO_DATA_RELEASE_SHA256:sha,ASSETS:{fetch:async()=>new Response(bytes)},VISITORS_DB:db,LIBRARY_R2:{get:async key=>{reads++;const value=listing.files.get(key.split('/').at(-1));return{size:value.length,body:new Response(value).body}}}}
 const request=async()=>{const r=await loadSeoDataRelease(env,'https://preview.test',{cache});return r.listing('browse',1)}
 assert.equal((await request()).rows[0].title,'كتاب');assert.equal(reads,1)
 sql.exec("INSERT INTO central_book_overrides VALUES('1','changed','author','category','public',NULL,'today',1)")
 assert.equal((await request()).rows[0].title,'changed');assert.equal(reads,1)
 sql.exec("UPDATE central_book_overrides SET visibility='private'")
 assert.equal((await request()).rows.length,0);assert.equal(reads,1);assert.equal(sessions,3);assert.equal(queries,3);sql.close()
})
test('identity cache skips both R2 ranges on a separate request and keeps contentVersion pinned',async()=>{
 const data=buildSeoIdentities({generatedAt:'2026-09-17T00:00:00Z',authors:[],books:[{id:'1',title:'كتاب',author:'مؤلف'}]})
 const bytes=Buffer.from(JSON.stringify({contract:'seo-data-release/1',identities:data.descriptor,listings:{releaseId:release}})),sha=createHash('sha256').update(bytes).digest('hex'),cache=memory();let reads=0
 const env={SEO_DATA_RELEASE_SHA256:sha,ASSETS:{fetch:async()=>new Response(bytes)},LIBRARY_R2:{get:async(key,{range})=>{reads++;const b=data.objects.get(key).subarray(range.offset,range.offset+range.length);return{body:new Response(b).body}}}}
 const a=await loadSeoDataRelease(env,'https://preview.test',{cache}),first=await a.identity('books','1')
 assert.equal(reads,2);const b=await loadSeoDataRelease(env,'https://preview.test',{cache}),second=await b.identity('books','1')
 assert.equal(reads,2);assert.deepEqual(first,second);assert.match(second.contentVersion,/^[a-f0-9]{64}$/)
})
test('preview and production cache origins are isolated and insecure remote origins are rejected',async()=>{
 const cache=memory();let calls=0;const load=async()=>({value:++calls})
 for(const origin of ['https://khzanah.com','https://preview.pages.dev'])await cachedSeoImmutable({cache,release,key:'same',origin,load})
 assert.equal(calls,2);assert.equal(new Set([...cache.rows.keys()].map(key=>new URL(key).origin)).size,2)
 assert.equal((await cachedSeoImmutable({cache,release,key:'same',origin:'https://khzanah.com',load})).value,1)
 for(const origin of ['http://remote.test','https://user:pass@khzanah.com','https://khzanah.com/path'])await assert.rejects(cachedSeoImmutable({cache,release,key:'same',origin,load}),/origin/)
 await cachedSeoImmutable({release,key:'local',origin:'http://127.0.0.1:5180',load})
})
