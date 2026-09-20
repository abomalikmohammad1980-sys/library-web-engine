import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readMergedPublicSeoListing,readMergedPublicSeoRelated,publicUploadAuthorId} from '../alpha-publish/functions/_seo-public-listings.js'
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE user_books(id TEXT PRIMARY KEY,title TEXT,author TEXT,category TEXT,updated_at TEXT,visibility TEXT DEFAULT 'public',review_status TEXT DEFAULT 'approved',deleted_at TEXT);CREATE TABLE user_book_metadata(book_id TEXT,central_author_id TEXT);CREATE TABLE central_authors(author_id TEXT,hidden_at TEXT);CREATE TABLE central_book_overrides(book_id TEXT,title TEXT,author TEXT,category TEXT,updated_at TEXT,revision INTEGER,visibility TEXT DEFAULT 'public',logically_deleted_at TEXT);`)
 let primary=0
 const db={withSession(mode){assert.equal(mode,'first-primary');primary++;return this},prepare(query){let args=[];return{bind(...values){args=values;return this},async first(){return sql.prepare(query).get(...args)},async all(){return{results:sql.prepare(query).all(...args)}}}}}
 const add=(id,category='قسم')=>sql.prepare('INSERT INTO user_books(id,title,author,category,updated_at) VALUES(?,?,?,?,?)').run(id,'عنوان '+id,'نفس الاسم',category,'2026-09-17')
 return{sql,db,add,primary:()=>primary}
}
const staticReader=(rows,kind='browse')=>async(list,page)=>{if(list!==kind)return null;const pages=Math.max(1,Math.ceil(rows.length/100));return page>pages?null:{page,pages,total:rows.length,rows:rows.slice((page-1)*100,page*100)}}

test('related projection matches first13 merged candidates without COUNT or redundant static reads',async()=>{
 const f=fixture();try{
  const rows=Array.from({length:100},(_,i)=>({kind:'book',id:String(i),title:'قديم',href:'/books/'+i}))
  for(let i=0;i<20;i++)f.add('u'+String(i).padStart(2,'0'))
  const expected=(await readMergedPublicSeoListing(f.db,staticReader(rows),'browse')).rows.slice(0,13)
  const queries=[],prepare=f.db.prepare;f.db.prepare=query=>{queries.push(query);return prepare(query)}
  let staticReads=0
  assert.deepEqual((await readMergedPublicSeoRelated(f.db,async()=>{staticReads++;return null},'browse')).rows,expected)
  assert.equal(staticReads,0);assert.equal(queries.length,2);assert.ok(queries.every(q=>!q.includes('COUNT(')&&q.endsWith('LIMIT 13')))
  const plan=f.sql.prepare('EXPLAIN QUERY PLAN '+queries[0]).all().map(r=>r.detail).join('\n')
  assert.doesNotMatch(plan,/MATERIALIZE current_uploads|SCAN current_uploads/)
  f.sql.exec("UPDATE user_books SET visibility='private' WHERE id>='u02'")
  const related=await readMergedPublicSeoRelated(f.db,staticReader(rows),'browse')
  assert.equal(related.rows.length,13);assert.equal(related.rows[2].id,'0')
 }finally{f.sql.close()}
})
test('related projection refuses a withdrawal during the immutable fetch',async()=>{
 const f=fixture();try{f.add('a');await assert.rejects(readMergedPublicSeoRelated(f.db,async()=>{f.sql.exec("UPDATE user_books SET visibility='private'");return null},'browse'),/listing_changed/)}finally{f.sql.close()}
})
test('125 fresh public uploads plus251 static books are discoverable once over4 bounded pages',async()=>{
 const f=fixture();try{
  for(let i=0;i<125;i++)f.add('u'+String(i).padStart(3,'0'))
  const rows=Array.from({length:251},(_,i)=>({kind:'book',id:String(i),title:'قديم',href:'/books/'+i})),seen=[]
  for(let page=1;page<=4;page++){let reads=0;const r=await readMergedPublicSeoListing(f.db,async(...args)=>{reads++;return staticReader(rows)(...args)},'browse',page);assert.equal(r.total,376);assert.equal(r.pages,4);assert(r.rows.length<=100);assert(reads<=3);seen.push(...r.rows.map(r=>r.href))}
  assert.equal(seen.length,376);assert.equal(new Set(seen).size,376);assert.equal(f.primary(),8)
 }finally{f.sql.close()}
})
test('private rejected deleted and hidden alias books never enter live discovery; edits are fresh',async()=>{
 const f=fixture();try{
  for(const id of ['visible','private','pending','deleted','hidden'])f.add(id)
  f.sql.exec("UPDATE user_books SET visibility='private' WHERE id='private';UPDATE user_books SET review_status='pending' WHERE id='pending';UPDATE user_books SET deleted_at='now' WHERE id='deleted';INSERT INTO central_book_overrides(book_id,visibility) VALUES('account-book:hidden','hidden')")
  const read=()=>readMergedPublicSeoListing(f.db,async()=>null,'new-books',1)
  assert.deepEqual((await read()).rows.map(r=>r.id),['visible'])
  f.sql.exec("UPDATE user_books SET title='عنوان جديد' WHERE id='visible'");assert.equal((await read()).rows[0].title,'عنوان جديد')
  f.sql.exec("UPDATE user_books SET visibility='private' WHERE id='visible'");assert.equal(await read(),null)
 }finally{f.sql.close()}
})
test('author affiliation requires an explicit visible central identity, never matching name',async()=>{
 const f=fixture();try{
  f.add('linked');f.add('same-name');f.sql.exec("INSERT INTO central_authors VALUES('shamela:20',NULL);INSERT INTO user_book_metadata VALUES('linked','shamela:20')")
  assert.equal(await publicUploadAuthorId(f.db,'linked'),'000020');assert.equal(await publicUploadAuthorId(f.db,'same-name'),undefined)
  assert.deepEqual((await readMergedPublicSeoListing(f.db,async()=>null,'author:000020')).rows.map(r=>r.id),['linked'])
  f.sql.exec("UPDATE central_authors SET hidden_at='now'");assert.equal(await publicUploadAuthorId(f.db,'linked'),undefined)
 }finally{f.sql.close()}
})
test('new category discovers uploads without an immutable category record and categories are deduplicated',async()=>{
 const f=fixture();try{
  f.add('a','جديد');f.add('b','جديد')
  const read=staticReader([{kind:'category',id:'جديد',title:'جديد',href:'/categories/'+encodeURIComponent('جديد')}],'categories')
  assert.equal((await readMergedPublicSeoListing(f.db,read,'category:جديد')).total,2)
  assert.equal((await readMergedPublicSeoListing(f.db,read,'categories')).total,1)
 }finally{f.sql.close()}
})
test('withdrawal during immutable asset read fails closed, never returns stale public titles',async()=>{
 const f=fixture();try{f.add('a');await assert.rejects(readMergedPublicSeoListing(f.db,async()=>{f.sql.exec("UPDATE user_books SET visibility='private'");return null},'browse'),/listing_changed/)}finally{f.sql.close()}
})
