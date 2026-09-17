const PUBLIC="b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides o WHERE o.book_id=b.id AND (o.visibility<>'public' OR o.logically_deleted_at IS NOT NULL))"
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
export async function publicSitemap(db,url){
 const raw=url.searchParams.get('page')??'1';if(!/^[1-9]\d{0,5}$/.test(raw))return new Response('invalid page',{status:400})
 const page=Number(raw)
 const result=await db.prepare(`SELECT b.id,b.updated_at FROM user_books b WHERE ${PUBLIC} ORDER BY b.id LIMIT 5000 OFFSET ?1`).bind((page-1)*5000).all()
 const rows=result.results??[]
 if(rows.some(row=>!/^[A-Za-z0-9_-]{1,200}$/.test(row.id)))throw Error('invalid_public_book_id')
 const body='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+rows.map(row=>`<url><loc>https://khzanah.com/books/public/${xml(row.id)}</loc>${Number.isFinite(Date.parse(row.updated_at))?`<lastmod>${new Date(row.updated_at).toISOString()}</lastmod>`:''}</url>`).join('')+'</urlset>'
 return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'no-store',...(url.hostname!=='khzanah.com'?{'x-robots-tag':'noindex'}:{})}})
}
export async function publicSitemapPages(db){
 const row=await db.prepare(`SELECT COUNT(*) AS count FROM user_books b WHERE ${PUBLIC}`).first()
 const count=Number(row?.count??0);if(!Number.isSafeInteger(count)||count<0||count>10000000)throw Error('public_sitemap_count')
 return Math.ceil(count/5000)
}
