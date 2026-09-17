import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {refreshPublicSeoRecord} from '../alpha-publish/functions/_seo-live-record.js'
const db=rows=>({prepare:sql=>({bind:(...args)=>({first:async()=>{const next=rows.shift();assert(next);assert.match(sql,next.sql);if(next.args)assert.deepEqual(args,next.args);return next.row}})})})
test('public author metadata refresh uses the same central identity as the biography editor',async()=>{
 const row={display_name:'اسم محدث',biography:'ترجمة محدثة',fields_json:'{"deathYearHijri":204}'}
 const result=await refreshPublicSeoRecord(db([{sql:/author_overrides/,args:['shamela:20','000020'],row}]),'authors','000020',{id:'000020',name:'الشافعي'})
 assert.equal(result.name,row.display_name);assert.equal(result.deathYearHijri,204)
})
test('fresh public metadata does not resurrect hidden or deleted books',async()=>{
 for(const row of [{visibility:'hidden'},{visibility:'unlisted'},{visibility:'public',logically_deleted_at:'2026-09-16'}]){
  assert.equal(await refreshPublicSeoRecord(db([{sql:/central_book_overrides/,args:['410021633','21633','shamela-21633'],row}]),'books','21633',{id:'21633',title:'old'}),undefined)
 }
})
test('new approved public books are discoverable and private books remain absent',async()=>{
 const rows=[{sql:/central_book_overrides/,row:null},{sql:/visibility='public' AND review_status='approved' AND deleted_at IS NULL/,row:{id:'new-book',title:'جديد',author:'مؤلف'}}]
 assert.equal((await refreshPublicSeoRecord(db(rows),'books','new-book')).title,'جديد')
 assert.equal(await refreshPublicSeoRecord(db([{sql:/central_book_overrides/,row:null},{sql:/review_status='approved'/,row:null}]),'books','private-book'),undefined)
})
test('changed author name never keeps a stale linked identity',async()=>{
 const result=await refreshPublicSeoRecord(db([{sql:/central_book_overrides/,row:{visibility:'public',author:'مؤلف جديد',title:'عنوان جديد',category:'الحديث'}}]),'books','20',{id:'20',title:'قديم',author:'قديم',authorId:'000020',deathYearHijri:200})
 assert.equal(result.title,'عنوان جديد');assert.equal(result.authorId,undefined);assert.equal(result.deathYearHijri,undefined)
})
test('public uploads honor hidden central-submission and account-book identities',async()=>{
 assert.equal(await refreshPublicSeoRecord(db([{sql:/central_book_overrides/,args:['upload','central-submission:upload','account-book:upload'],row:{visibility:'hidden'}}]),'books','upload'),undefined)
})
test('actual SQL: an older hidden or deleted alias vetoes a newer public override',async()=>{
 const sql=new DatabaseSync(':memory:')
 try{
  sql.exec('CREATE TABLE central_book_overrides(book_id TEXT PRIMARY KEY,title TEXT,author TEXT,category TEXT,visibility TEXT,logically_deleted_at TEXT,updated_at TEXT,revision INTEGER)')
  const adapter={prepare:query=>({bind:(...args)=>({first:async()=>sql.prepare(query).get(...args)??null})})}
  for(const [id,privateAlias,publicAlias] of [['upload','central-submission:upload','account-book:upload'],['21633','shamela-21633','410021633']]){
   for(const [visibility,deleted] of [['hidden',null],['unlisted',null],['public','2026-09-17']]){
    sql.exec('DELETE FROM central_book_overrides')
    const insert=sql.prepare('INSERT INTO central_book_overrides(book_id,title,visibility,logically_deleted_at,revision) VALUES(?,?,?,?,?)')
    insert.run(privateAlias,'private',visibility,deleted,1);insert.run(publicAlias,'newer public','public',null,99)
    assert.equal(await refreshPublicSeoRecord(adapter,'books',id,{id,title:'packaged public',author:'author'}),undefined)
   }
   sql.prepare('DELETE FROM central_book_overrides WHERE book_id=?').run(privateAlias)
   assert.equal((await refreshPublicSeoRecord(adapter,'books',id,{id,title:'packaged public',author:'author'})).title,'newer public')
  }
 }finally{sql.close()}
})
