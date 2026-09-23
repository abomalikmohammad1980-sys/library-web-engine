import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {visibleSeoListingRows} from '../alpha-publish/functions/_seo-listings.js'

test('sparse override scan preserves fresh withdrawal, latest revision and category without hundreds of empty index probes',async()=>{
 const sqlite=new DatabaseSync(':memory:')
 try{
  sqlite.exec(`CREATE TABLE central_book_overrides(book_id TEXT PRIMARY KEY,title TEXT,author TEXT,category TEXT,visibility TEXT,logically_deleted_at TEXT,updated_at TEXT,revision INTEGER)`)
  const insert=sqlite.prepare('INSERT INTO central_book_overrides VALUES(?,?,?,?,?,?,?,?)')
  insert.run('1','قديم','مؤلف','قسم','public',null,'a',1)
  insert.run('410000001','جديد','مؤلف','قسم','public',null,'b',2)
  insert.run('shamela-2',null,null,'قسم','hidden',null,'c',1)
  insert.run('3',null,null,'آخر','public',null,'c',1)
  insert.run('shamela-4',null,null,'قسم','public','c','c',1)
  let calls=0
  const db={prepare(sql){assert.match(sql,/FROM central_book_overrides LIMIT 65/);return {async all(){
   calls++
   const plan=sqlite.prepare('EXPLAIN QUERY PLAN '+sql).all()
   assert(plan.some(p=>p.detail.includes('SCAN central_book_overrides')))
   assert(plan.every(p=>!p.detail.includes('VIRTUAL TABLE')))
   return {results:sqlite.prepare(sql).all()}
  }}}}
  const rows=Array.from({length:100},(_,i)=>({kind:'book',id:String(i+1),title:'عنوان',category:'قسم'}))
  const visible=await visibleSeoListingRows(db,rows,{list:'category:قسم'})
  assert.equal(visible.length,97)
  assert.equal(visible[0].title,'جديد')
  assert(!visible.some(r=>['2','3','4'].includes(r.id)))
  sqlite.prepare("UPDATE central_book_overrides SET visibility='hidden' WHERE book_id='1'").run()
  assert(!(await visibleSeoListingRows(db,rows)).some(r=>r.id==='1'))
  assert.equal(calls,2)
 }finally{sqlite.close()}
})

test('large override tables fall back to a complete alias-bound query, including a late hidden alias',async()=>{
 const sqlite=new DatabaseSync(':memory:')
 try{
  sqlite.exec(`CREATE TABLE central_book_overrides(book_id TEXT PRIMARY KEY,title TEXT,author TEXT,category TEXT,visibility TEXT,logically_deleted_at TEXT,updated_at TEXT,revision INTEGER)`)
  const insert=sqlite.prepare('INSERT INTO central_book_overrides VALUES(?,?,?,?,?,?,?,?)')
  for(let index=0;index<65;index++)insert.run(`other-${index}`,null,null,null,'public',null,null,1)
  insert.run('shamela-2',null,null,null,'hidden',null,null,1)
  const seen=[]
  const db={prepare(sql){seen.push(sql);return {all:async()=>({results:sqlite.prepare(sql).all()}),bind(...args){assert.equal(args.length,1);return {all:async()=>({results:sqlite.prepare(sql).all(...args)})}}}}}
  const visible=await visibleSeoListingRows(db,[{kind:'book',id:'1',title:'أول'},{kind:'book',id:'2',title:'ثان'}])
  assert.deepEqual(visible.map(row=>row.id),['1'])
  assert.equal(seen.length,2)
  assert.match(seen[1],/book_id IN \(json_extract/)
 }finally{sqlite.close()}
})
