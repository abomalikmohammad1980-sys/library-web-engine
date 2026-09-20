import {plainSeoText} from '../../app/src/page_meta_model.ts'
const SIZE=100,MAX_BYTES=200000
const visible=`b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides h WHERE h.book_id IN(b.id,'central-submission:'||b.id,'account-book:'||b.id) AND(h.visibility<>'public' OR h.logically_deleted_at IS NOT NULL))`
const base=`WITH current_uploads AS (SELECT b.id,COALESCE(NULLIF(o.title,''),b.title) title,COALESCE(NULLIF(o.author,''),b.author) author,CASE WHEN o.book_id IS NULL THEN COALESCE(b.category,'') ELSE COALESCE(o.category,'') END category,COALESCE(o.updated_at,b.updated_at) updated_at,
 CASE WHEN o.author IS NOT NULL AND o.author<>'' AND o.author<>b.author THEN NULL ELSE m.central_author_id END author_id
 FROM user_books b LEFT JOIN user_book_metadata m ON m.book_id=b.id LEFT JOIN central_book_overrides o ON o.book_id=(SELECT x.book_id FROM central_book_overrides x WHERE x.book_id IN(b.id,'central-submission:'||b.id,'account-book:'||b.id) ORDER BY x.revision DESC,x.book_id LIMIT 1) WHERE ${visible})`
function checked(record){if(new TextEncoder().encode(JSON.stringify(record)).length>MAX_BYTES)throw Error('seo_public_listing_size');return record}
function authorIds(list){const id=list.slice(7);if(!/^\d{6,12}$/.test(id))return null;return [id,'shamela:'+Number(id)]}
function predicate(list){
 if(list==='browse'||list==='new-books')return {sql:'1',args:[]}
 if(list.startsWith('category:'))return {sql:'category=?1',args:[list.slice(9)]}
 const ids=list.startsWith('author:')?authorIds(list):null
 if(ids)return{sql:"author_id IN (?1,?2) AND EXISTS(SELECT 1 FROM central_authors a WHERE a.author_id=current_uploads.author_id AND a.hidden_at IS NULL)",args:ids}
 return null
}
function row(value){
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(value.id))throw Error('seo_public_book_id')
 return {kind:'book',id:value.id,title:plainSeoText(value.title),author:plainSeoText(value.author),category:plainSeoText(value.category),href:'/books/public/'+value.id,updatedAt:value.updated_at}
}
async function categories(db,readStatic,page){
 const first=await readStatic('categories',1),rows=[...(first?.rows??[])]
 if((first?.pages??0)>10)throw Error('seo_category_merge_bound')
 for(let p=2;p<=(first?.pages??0);p++)rows.push(...((await readStatic('categories',p))?.rows??[]))
 const live=await db.prepare(`${base} SELECT DISTINCT category FROM current_uploads WHERE trim(category)<>'' ORDER BY category LIMIT 1001`).all()
 if((live.results?.length??0)>1000)throw Error('seo_category_merge_bound')
 const byHref=new Map(rows.map(value=>[value.href,value]))
 for(const value of live.results??[]){const title=plainSeoText(value.category);if(!title||title.includes('/')||title.includes('\\'))continue;const href='/categories/'+encodeURIComponent(title);byHref.set(href,{kind:'category',id:title,title,href})}
 const merged=[...byHref.values()].sort((a,b)=>a.title<b.title?-1:a.title>b.title?1:0),pages=Math.max(1,Math.ceil(merged.length/SIZE))
 return page>pages?null:checked({page,pages,total:merged.length,totalExact:true,rows:merged.slice((page-1)*SIZE,page*SIZE)})
}
/** Uploads occupy a stable prefix; static slots retain immutable offsets, so a
 * boundary page reads at most two bounded catalog pages, never the full index. */
export async function readMergedPublicSeoListing(db,readStatic,list,page=1){
 if(!Number.isSafeInteger(page)||page<1||page>1000000)throw Error('seo_public_listing_page')
 if(db&&list==='categories')return categories(typeof db.withSession==='function'?db.withSession('first-primary'):db,readStatic,page)
 const filter=predicate(list)
 if(!db||!filter)return readStatic(list,page)
 const authority=db
 if(typeof db.withSession==='function')db=db.withSession('first-primary')
 const offset=(page-1)*SIZE,args=[...filter.args,offset],offsetParam='?'+args.length
 const query=`${base} SELECT (SELECT COUNT(*) FROM current_uploads WHERE ${filter.sql}) total, (SELECT json_group_array(json_object('id',id,'title',title,'author',author,'category',category,'updated_at',updated_at)) FROM (SELECT * FROM current_uploads WHERE ${filter.sql} ORDER BY updated_at DESC,id LIMIT 100 OFFSET ${offsetParam})) rows_json`
 const result=await db.prepare(query).bind(...args).first()
 const uploads=Number(result?.total??0),dynamic=JSON.parse(result?.rows_json??'[]').map(row)
 const first=await readStatic(list,1),staticTotal=first?.total??0,total=uploads+staticTotal,pages=Math.max(1,Math.ceil(total/SIZE))
 if(page>pages||(!first&&!uploads))return null
 const need=SIZE-dynamic.length,staticOffset=Math.max(0,offset-uploads),statics=[]
 if(need&&staticOffset<staticTotal){
  const firstPage=Math.floor(staticOffset/SIZE)+1,within=staticOffset%SIZE
  const a=firstPage===1?first:await readStatic(list,firstPage)
  statics.push(...(a?.rows??[]).slice(within,within+need))
  // Immutable slot boundaries, not filtered row count, determine the second page.
  if(within+need>SIZE&&firstPage<(first?.pages??0)){const b=await readStatic(list,firstPage+1);statics.push(...(b?.rows??[]).slice(0,within+need-SIZE))}
 }
 const currentDb=typeof authority.withSession==='function'?authority.withSession('first-primary'):authority
 const current=await currentDb.prepare(query).bind(...args).first()
 if(JSON.stringify(current)!==JSON.stringify(result))throw Error('seo_public_listing_changed')
 return checked({page,pages,total,totalExact:staticTotal===0,rows:[...dynamic,...statics].slice(0,SIZE)})
}

/** Related books need only thirteen candidates (twelve plus the current book),
 * not a total/pagination count over every upload. Keep the fresh primary fence. */
export async function readMergedPublicSeoRelated(db,readStatic,list){
 const filter=predicate(list)
 if(!db||!filter)return readStatic(list,1)
 const query=`${base} SELECT id,title,author,category,updated_at FROM current_uploads WHERE ${filter.sql} ORDER BY updated_at DESC,id LIMIT 13`
 const read=async()=>{
  const current=typeof db.withSession==='function'?db.withSession('first-primary'):db
  return (await current.prepare(query).bind(...filter.args).all()).results??[]
 }
 const before=await read()
 const statics=before.length<13?await readStatic(list,1):null
 const after=await read()
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('seo_public_listing_changed')
 return checked({rows:[...before.map(row),...(statics?.rows??[])].slice(0,13)})
}

/** Identity affiliation uses the stored reviewed central-author link, not names. */
export async function publicUploadAuthorId(db,id){
 if(!db||!/^[A-Za-z0-9_-]{1,200}$/.test(id))return undefined
 if(typeof db.withSession==='function')db=db.withSession('first-primary')
 const value=await db.prepare(`${base} SELECT author_id FROM current_uploads WHERE id=?1 AND EXISTS(SELECT 1 FROM central_authors a WHERE a.author_id=current_uploads.author_id AND a.hidden_at IS NULL)`).bind(id).first()
 const match=/^(?:shamela:)?(\d{1,12})$/.exec(value?.author_id??'')
 return match?String(Number(match[1])).padStart(6,'0'):undefined
}
