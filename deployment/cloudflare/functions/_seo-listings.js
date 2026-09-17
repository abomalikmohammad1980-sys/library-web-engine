export const SEO_LISTING_BUCKETS=512,SEO_LISTING_MAX_BYTES=200000,SEO_LISTING_PAGE_SIZE=100
export function listingBucket(key){let hash=2166136261;for(const char of key){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619)}return String((hash>>>0)%SEO_LISTING_BUCKETS).padStart(3,'0')}
export function listingPageKey(list,page){if(typeof list!=='string'||list.length>1000||!Number.isSafeInteger(page)||page<1||page>1000000)throw Error('seo_listing_key');return `${list}|${page}`}
export function listingPageUrl(path,page){if(!path.startsWith('/')||path.startsWith('//')||/[?#]/.test(path)||!Number.isSafeInteger(page)||page<1)throw Error('seo_listing_url');return path+(page===1?'':`?page=${page}`)}
export async function readSeoListing(assets,origin,list,page=1,{bucket,releaseId}={}){
 const key=listingPageKey(list,page),name=`lists-${listingBucket(key)}.json`
 let response
 if(bucket){
  if(!/^[a-f0-9]{64}$/.test(releaseId??''))throw Error('seo_listing_release')
  const object=await bucket.get(`seo/listings/${releaseId}/${name}`)
  if(!object)return null
  if(!Number.isSafeInteger(object.size)||object.size<1||object.size>SEO_LISTING_MAX_BYTES)throw Error('seo_listing_size')
  response=new Response(object.body)
 }else response=await assets.fetch(new URL(`/data/seo/${name}`,origin))
 if(response.status===404)return null
 if(!response.ok||!response.body)throw Error('seo_listing_unavailable')
 const reader=response.body.getReader(),chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>SEO_LISTING_MAX_BYTES)throw Error('seo_listing_size');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),record=data.records?.[key]
 if(data.contract!=='seo-listings/1')throw Error('seo_listing_contract')
 if(!record)return null
 if(record.page!==page||!Number.isSafeInteger(record.pages)||record.pages<page||!Number.isSafeInteger(record.total)||record.total<0||!Array.isArray(record.rows)||record.rows.length>SEO_LISTING_PAGE_SIZE)throw Error('seo_listing_record')
 for(const row of record.rows)if(typeof row.title!=='string'||typeof row.href!=='string'||!/^\/(?:books\/\d+|authors\/\d{6,12}|categories\/[^/?#]+)$/.test(row.href))throw Error('seo_listing_link')
 return record
}
/** Metadata visibility must be refreshed before this projection is rendered.
 * This filter uses the same conservative alias veto as public book metadata. */
export async function visibleSeoListingRows(db,rows){
 if(!db)return rows
 const ids=rows.filter(row=>row.kind==='book').map(row=>row.id)
 if(!ids.length)return rows
 const hidden=new Set()
 // Keep each D1 statement well under the parameter limit (3 aliases/book).
 for(let start=0;start<ids.length;start+=25){
  const group=ids.slice(start,start+25),aliases=group.flatMap(id=>[id,String(410000000+Number(id)),'shamela-'+id])
  const result=await db.prepare(`SELECT book_id FROM central_book_overrides WHERE book_id IN (${aliases.map(()=>'?').join(',')}) AND (visibility<>'public' OR logically_deleted_at IS NOT NULL)`).bind(...aliases).all()
  for(const row of result.results??[])for(const id of group)if([id,String(410000000+Number(id)),'shamela-'+id].includes(row.book_id))hidden.add(id)
 }
 return rows.filter(row=>row.kind!=='book'||!hidden.has(row.id))
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function renderSeoListing(record,path,visibleRows){
 const rows=visibleRows??record.rows
 const items=rows.map(row=>`<li><a href="${escape(row.href)}">${escape(row.title)}</a></li>`).join('')
 return `<ul>${items}</ul><nav aria-label="صفحات القائمة">${record.page>1?`<a rel="prev" href="${escape(listingPageUrl(path,record.page-1))}">السابق</a>`:''}${record.page<record.pages?`<a rel="next" href="${escape(listingPageUrl(path,record.page+1))}">التالي</a>`:''}</nav>`
}
export function relatedSeoRows(rows,currentId){return rows.filter(row=>row.kind==='book'&&row.id!==currentId).slice(0,12)}
