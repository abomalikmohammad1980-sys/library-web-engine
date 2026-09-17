import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {listingBucket,listingPageKey,SEO_LISTING_MAX_BYTES,SEO_LISTING_PAGE_SIZE} from '../alpha-publish/functions/_seo-listings.js'
/** In-memory proposal builder; caller explicitly writes/reviews returned assets.
 * Input must be the reviewed public packaged catalog, never account/private rows. */
export function buildSeoListings({books,authors,generatedAt}){
 assert(Number.isFinite(Date.parse(generatedAt)),'listing_generation_required')
 const bookIds=new Set(),authorIds=new Set(),groups=new Map()
 const bookRows=books.map(book=>{assert(/^\d{1,12}$/.test(book.id)&&!bookIds.has(book.id),'listing_book_id');bookIds.add(book.id);assert(typeof book.title==='string'&&book.title.length>0);return{kind:'book',id:book.id,title:book.title,href:'/books/'+book.id}})
 const authorRows=authors.map(author=>{assert(/^\d{6,12}$/.test(author.id)&&!authorIds.has(author.id),'listing_author_id');authorIds.add(author.id);return{kind:'author',id:author.id,title:author.name,href:'/authors/'+author.id}})
 groups.set('authors',authorRows.sort((a,b)=>a.title.localeCompare(b.title,'ar')||a.id.localeCompare(b.id)))
 groups.set('browse',[...bookRows].sort((a,b)=>a.title.localeCompare(b.title,'ar')||Number(a.id)-Number(b.id)))
 const byId=new Map(books.map(book=>[book.id,book]))
 // Prefer genuine publication/addition timestamps; deterministic ID ordering is
 // the explicit fallback for legacy packaged records without such timestamps.
 groups.set('new-books',[...bookRows].sort((a,b)=>(Date.parse(byId.get(b.id).publishedAt??'')||0)-(Date.parse(byId.get(a.id).publishedAt??'')||0)||Number(b.id)-Number(a.id)))
 const categories=new Set()
 for(const row of bookRows){const book=byId.get(row.id);if(book.authorId){assert(authorIds.has(book.authorId),'listing_author_missing');const key='author:'+book.authorId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}if(book.category){categories.add(book.category);const key='category:'+book.category;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}}
 for(const author of authors)if(!groups.has('author:'+author.id))groups.set('author:'+author.id,[])
 groups.set('categories',[...categories].sort((a,b)=>a.localeCompare(b,'ar')).map(name=>({kind:'category',id:name,title:name,href:'/categories/'+encodeURIComponent(name)})))
 const buckets=new Map();let pageRecords=0
 for(const [list,rows] of groups){const pages=Math.max(1,Math.ceil(rows.length/SEO_LISTING_PAGE_SIZE));for(let page=1;page<=pages;page++){const key=listingPageKey(list,page),bucket=listingBucket(key);if(!buckets.has(bucket))buckets.set(bucket,{});buckets.get(bucket)[key]={page,pages,total:rows.length,rows:rows.slice((page-1)*SEO_LISTING_PAGE_SIZE,page*SEO_LISTING_PAGE_SIZE)};pageRecords++}}
 const files=new Map();for(const [bucket,records] of buckets){const bytes=Buffer.from(JSON.stringify({contract:'seo-listings/1',generatedAt,records}));assert(bytes.length<SEO_LISTING_MAX_BYTES,'listing_bucket_over_budget:'+bucket);files.set(`lists-${bucket}.json`,bytes)}
 const releaseHash=createHash('sha256');for(const [name,bytes] of [...files].sort(([a],[b])=>a.localeCompare(b)))releaseHash.update(name+'\n').update(bytes)
 return{files,report:{releaseId:releaseHash.digest('hex'),books:bookRows.length,authors:authorRows.length,categories:categories.size,logicalLists:groups.size,pageRecords,assets:files.size,maxBytes:Math.max(...[...files.values()].map(b=>b.length)),newBooksFallback:'descending-source-id-when-no-publication-time'}}
}
