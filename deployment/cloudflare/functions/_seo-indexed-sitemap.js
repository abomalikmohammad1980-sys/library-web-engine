// Stage B verified publication sitemap, including bookmark-only scanned PDFs.
const FROM=`FROM user_books b JOIN books_index_state s ON s.book_id=b.id
WHERE s.visibility='public' AND s.status IN ('ready','ocr_pending') AND s.indexed_at IS NOT NULL
AND b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL
AND NOT EXISTS(SELECT 1 FROM central_book_overrides o
WHERE o.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id)
AND (o.visibility<>'public' OR o.logically_deleted_at IS NOT NULL))`
const primary=db=>typeof db.withSession==='function'?db.withSession('first-primary'):db
function outgoing(response,url){
 const headers=new Headers(response.headers);headers.set('cache-control','private, no-store')
 if(url.hostname!=='khzanah.com')headers.set('x-robots-tag','noindex')
 return new Response(response.body,{status:response.status,headers})
}
async function keyFor(url,rows){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)))
 const version=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')
 const key=new URL(url);key.searchParams.set('__seo_sitemap_v','1-'+version)
 return new Request(key,{method:'GET'})
}
function render(rows){
 const body='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+rows.map(row=>`<url><loc>https://khzanah.com/books/public/${row.id}</loc><lastmod>${new Date(row.indexed_at*1000).toISOString()}</lastmod></url>`).join('')+'</urlset>'
 return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600'}})
}
export async function indexedSitemap(db,url,{cache,waitUntil}={}){
 const values=url.searchParams.getAll('page'),raw=values[0]??'1'
 if(values.length>1||[...url.searchParams.keys()].some(k=>k!=='page')||!/^[1-9]\d{0,5}$/.test(raw))return outgoing(new Response('invalid page',{status:400}),url)
 const page=Number(raw)
 const read=async()=>{
  const result=await primary(db).prepare(`SELECT b.id,s.indexed_at,s.content_version ${FROM} ORDER BY b.id LIMIT 5000 OFFSET ?1`).bind((page-1)*5000).all()
  const rows=result.results??[]
  if(rows.length>5000||rows.some(row=>!/^[A-Za-z0-9_-]{1,200}$/.test(row.id)||!Number.isSafeInteger(row.indexed_at)||row.indexed_at<0||row.indexed_at>8640000000000))throw Error('invalid_sitemap_row')
  return rows
 }
 const rows=await read()
 if(page>1&&!rows.length)return outgoing(new Response('not found',{status:404}),url)
 if(!cache)return outgoing(render(rows),url)
 const key=await keyFor(url,rows)
 let hit;try{hit=await cache.match(key)}catch{/* A cache outage does not authorize stale data. */}
 const current=await read(),currentKey=await keyFor(url,current)
 if(currentKey.url!==key.url)return outgoing(render(current),url)
 if(hit)return outgoing(hit,url)
 const response=render(rows),put=cache.put(key,response.clone()).catch(()=>{})
 if(waitUntil)waitUntil(put);else await put
 return outgoing(response,url)
}
export async function indexedSitemapPages(db){
 const row=await primary(db).prepare(`SELECT COUNT(*) AS count ${FROM}`).first()
 const count=Number(row?.count??0);if(!Number.isSafeInteger(count)||count<0||count>10000000)throw Error('public_sitemap_count')
 return Math.ceil(count/5000)
}
