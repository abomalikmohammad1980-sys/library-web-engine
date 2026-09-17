import {PUBLIC_PAGE_META,pageMetaFor,publicPageHeading,seoShard,SEO_ORIGIN} from '../../app/src/page_meta_model.ts'
import {httpRoutePolicy} from '../../app/src/http_route_policy.ts'
import {canonicalizePath} from '../../app/src/path_location.ts'
import {readSeoToc} from './_seo-toc.js'
import {readPublicSeoToc} from './_seo-public-toc.js'
import {refreshPublicSeoRecord} from './_seo-live-record.js'
import {publicSitemap,publicSitemapPages} from './_seo-public-sitemap.js'
import {boundedBytes} from './_seo-toc.js'
import {seoPresentation,seoNavLabels} from './_seo-presentation.js'
import {loadSeoDataRelease,seoListingPage} from './_seo-data-release.js'
import {renderSeoListing,relatedSeoRows} from './_seo-listings.js'
import {serveVersionedPublicHtml} from './_seo-edge-cache.js'
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
async function smallJson(response){
 if(!response.ok)throw Error('seo_data_unavailable')
 const reader=response.body.getReader(),chunks=[];let length=0
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1048576)throw Error('seo_data_too_large');chunks.push(value)}}catch(e){await reader.cancel();throw e}finally{reader.releaseLock()}
 const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
export async function onRequest(context){
 const {request,env}=context,url=new URL(request.url),path=url.pathname,preview=url.hostname!=='khzanah.com'
 if(url.hostname==='www.khzanah.com'){url.hostname='khzanah.com';url.protocol='https:';return Response.redirect(url.href,301)}
 if(['GET','HEAD'].includes(request.method)&&env.VISITORS_DB&&['/sitemap.xml','/sitemap-public.xml'].includes(path)){
  try{
   let response
   if(path==='/sitemap-public.xml')response=await publicSitemap(env.VISITORS_DB,url)
   else{
    const source=await env.ASSETS.fetch(new URL('/sitemap.xml',url));if(!source.ok)throw Error('sitemap_unavailable')
    const content=new TextDecoder().decode(await boundedBytes(source.body,1048576)),pages=await publicSitemapPages(env.VISITORS_DB)
    const additions=Array.from({length:pages},(_,index)=>`<sitemap><loc>https://khzanah.com/sitemap-public.xml?page=${index+1}</loc></sitemap>`).join('')
    response=new Response(content.replace('</sitemapindex>',additions+'</sitemapindex>'),{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'no-store',...(preview?{'x-robots-tag':'noindex'}:{})}})
   }
   return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response
  }catch{return new Response('sitemap temporarily unavailable',{status:503,headers:{'x-robots-tag':'noindex','cache-control':'no-store'}})}
 }
 // /api remains routed to existing Functions; SEO never reads or rewrites it.
 if(!['GET','HEAD'].includes(request.method)||/^\/(api|assets|data|library|fonts|icons|downloads)\//.test(path)||/\.[a-z0-9]+$/i.test(path)){
  const response=await context.next()
  if(!preview)return response
  const headers=new Headers(response.headers);headers.set('X-Robots-Tag','noindex')
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers})
 }
 const route=httpRoutePolicy(path,url.search)
 if(route.kind==='redirect'){
  const target=new URL(route.path,url),headers=new Headers({location:target.href})
  if(preview)headers.set('X-Robots-Tag','noindex')
  return new Response(null,{status:301,headers})
 }
 if(route.kind==='not-found'){
  const page=await env.ASSETS.fetch(new URL('/404.html',url)),headers=new Headers(page.headers)
  headers.set('X-Robots-Tag','noindex, follow');headers.set('cache-control','no-store')
  return new Response(request.method==='HEAD'?null:page.body,{status:404,headers})
 }
 let record,baseRecord,status=200
 const canonicalPath=canonicalizePath(path)
 const match=/^\/(authors|books)\/(\d{1,12})$/.exec(canonicalPath)
 const categoryPath=path==='/categories'||path.startsWith('/categories/')
 const categoryName=path.startsWith('/categories/')?decodeURIComponent(path.slice('/categories/'.length)):undefined
 try{
  const release=match||PUBLIC_PAGE_META[path]||categoryPath?await loadSeoDataRelease(env,url):null
  if(categoryPath&&!release)throw Error('seo_categories_release_required')
  if(match){const kind=match[1],id=kind==='authors'?match[2].padStart(6,'0'):String(Number(match[2]));baseRecord=release?await release.identity(kind,id):(await smallJson(await env.ASSETS.fetch(new URL(`/data/seo/${kind}-${seoShard(id)}.json`,url)))).records[id];record=await refreshPublicSeoRecord(env.VISITORS_DB,kind,id,baseRecord);if(!record)status=404;else if(path!==`/${kind}/${id}`){url.pathname=`/${kind}/${id}`;return Response.redirect(url.href,301)}}
  else if(/^\/books\/public\/[A-Za-z0-9_-]{1,200}$/.test(path)){record=await refreshPublicSeoRecord(env.VISITORS_DB,'books',path.split('/')[3],undefined,{publicUpload:true});if(!record)status=404}
  else if(/^\/authors\//.test(path))status=404
  const listKey=categoryPath?(categoryName?'category:'+categoryName:'categories'):record?.name?'author:'+record.id:['/authors','/browse','/new-books'].includes(path)?path.slice(1):null
  let listing
  if(release&&listKey&&status===200){const page=seoListingPage(url);listing=page===null?null:await release.listing(listKey,page);if(!listing){status=404;record=undefined}}
  const loadRelated=async current=>{
   if(!release||!current?.title)return []
   const groups=[]
   for(const [key,label] of [[current.authorId?'author:'+current.authorId:null,'كتب أخرى للمؤلف'],[current.category?'category:'+current.category:null,'من القسم نفسه']]){
    if(key){const group=await release.listing(key,1);groups.push({label,rows:relatedSeoRows(group?.rows??[],current.id)})}
   }
   return groups
  }
  const renderPage=async(record,status,listing,related=[])=>{
  // Opaque local/account book identities belong to the private SPA, never public SEO.
  const meta=status===404?{title:'الصفحة غير موجودة | الخِزانة',description:'لم يُعثر على الكتاب أو المؤلف المطلوب.',robots:'noindex, follow'}:pageMetaFor(path+url.search,record??(categoryName?{id:'',category:categoryName}:undefined))
  const schema=[{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'الخِزانة',item:SEO_ORIGIN+'/'},...(path==='/'?[]:[{'@type':'ListItem',position:2,name:record?.title??record?.name??meta.title,item:SEO_ORIGIN+path}])]}]
  if(path==='/')schema.push({'@context':'https://schema.org','@type':'WebSite',name:'الخزانة',alternateName:'الخزانة: المكتبة الإسلامية الذكية',url:SEO_ORIGIN+'/',inLanguage:'ar'})
  const heading=status===404?meta.title:record?.title??record?.name??categoryName??publicPageHeading(path)??meta.title
  let body=`<main id="main-content" class="seo-page${path==='/'?' seo-page--home':''}"><h1>${escape(heading)}</h1><p>${escape(meta.description)}</p>`
  if(record?.title){
   body+=`<p>${record.authorId?`<a href="/authors/${escape(record.authorId)}">${escape(record.author)}</a>`:escape(record.author)}${record.deathYearHijri?` (ت ${record.deathYearHijri} هـ)`:''}</p><p>${release&&record.category?`<a href="/categories/${encodeURIComponent(record.category)}">${escape(record.category)}</a>`:escape(record.category)}</p><a href="/browse">تصفح الأقسام</a>`
   schema.push({'@context':'https://schema.org','@type':'Book',name:record.title,url:SEO_ORIGIN+path,author:{'@type':'Person',name:record.author,...(record.authorId?{url:SEO_ORIGIN+'/authors/'+record.authorId}:{})},genre:record.category,inLanguage:'ar'})
   if(release){
    for(const {label,rows} of related){
     if(rows.length)body+=`<section><h2>${label}</h2><ul>${rows.map(row=>`<li><a href="${escape(row.href)}">${escape(row.title)}</a></li>`).join('')}</ul></section>`
    }
   }
   if(record.toc){
    const rows=await readSeoToc(env.ASSETS,url,record.toc,env.LIBRARY_R2),rawPage=url.searchParams.get('tocPage')??'1'
    const tocPage=/^[1-9]\d{0,5}$/.test(rawPage)?Number(rawPage):1,start=(tocPage-1)*200
    body+=`<section aria-label="فهرس محتويات الكتاب"><h2>فهرس المحتويات</h2><ol start="${start+1}">${rows.slice(start,start+200).map(row=>`<li>${row.pageIndex===null?escape(row.title):`<a href="/books/${record.id}?pageIndex=${row.pageIndex}">${escape(row.title)}</a>`}</li>`).join('')}</ol>`
    if(start>0)body+=`<a href="/books/${record.id}?tocPage=${tocPage-1}">السابق من الفهرس</a>`
    if(start+200<rows.length)body+=`<a href="/books/${record.id}?tocPage=${tocPage+1}">التالي من الفهرس</a>`
    body+='</section>'
   }
   else if(path.startsWith('/books/public/')&&env.PUBLIC_BOOK_INGESTION_ENABLED==='true'){
    const toc=await readPublicSeoToc(env,record.id)
    if(toc){
     const rawPage=url.searchParams.get('tocPage')??'1',tocPage=/^[1-9]\d{0,5}$/.test(rawPage)?Number(rawPage):1,start=(tocPage-1)*200,base=`/books/public/${encodeURIComponent(record.id)}`
     body+=`<section aria-label="فهرس محتويات الكتاب"><h2>${toc.coverageMode==='pdf-bookmarks-only'?'العلامات المرجعية للنسخة المصورة':'فهرس المحتويات'}</h2><ol start="${start+1}">${toc.rows.slice(start,start+200).map(row=>`<li>${row.href?`<a href="${escape(row.href)}">${escape(row.title)}</a>`:escape(row.title)}</li>`).join('')}</ol>`
     if(start>0)body+=`<a href="${base}?tocPage=${tocPage-1}">السابق من الفهرس</a>`
     if(start+200<toc.rows.length)body+=`<a href="${base}?tocPage=${tocPage+1}">التالي من الفهرس</a>`
     body+='</section>'
    }
   }
  }else if(record?.name){
   body+=listing?renderSeoListing(listing,path):`<ul>${(record.books??[]).map(b=>`<li><a href="/books/${escape(b.id)}">${escape(b.title)}</a></li>`).join('')}</ul>`
   schema.push({'@context':'https://schema.org','@type':'Person',name:record.name,url:SEO_ORIGIN+path,description:meta.description})
  }else if(status===200&&(PUBLIC_PAGE_META[path]||categoryPath)){
   body+=`<nav aria-label="أقسام الخزانة">${Object.keys(PUBLIC_PAGE_META).map(p=>`<a href="${p}">${escape(seoNavLabels[p])}</a>`).join('')}</nav>`
   if(listing)body+=renderSeoListing(listing,path)
   else if(release){const sample=await release.listing('new-books',1);body+=`<ul>${(sample?.rows??[]).slice(0,12).map(row=>`<li><a href="${escape(row.href)}">${escape(row.title)}</a></li>`).join('')}</ul>`}
   else{const kind=path==='/authors'?'authors':'books',data=await smallJson(await env.ASSETS.fetch(new URL(`/data/seo/${kind}-00.json`,url)));body+=`<ul>${Object.values(data.records).slice(0,40).map(row=>`<li><a href="/${kind}/${escape(row.id)}">${escape(row.title??row.name)}</a></li>`).join('')}</ul>`}
   schema.push({'@context':'https://schema.org','@type':'CollectionPage',name:meta.title,url:SEO_ORIGIN+path,description:meta.description})
  }
  body+='</main>'
  const index=await env.ASSETS.fetch(new URL('/index.html',url));if(!index.ok)throw Error('seo_shell_unavailable')
  let extra=seoPresentation+`<meta name="description" content="${escape(meta.description)}"><meta name="robots" content="${escape(meta.robots)}">`
  if(meta.canonicalPath)extra+=`<link rel="canonical" href="${SEO_ORIGIN}${escape(meta.canonicalPath)}">`
  if(!meta.robots.includes('noindex'))extra+=`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`
  const rewritten=new HTMLRewriter().on('title',{element:e=>e.setInnerContent(meta.title)}).on('meta[name="description"], meta[name="robots"], link[rel="canonical"], script[type="application/ld+json"]',{element:e=>e.remove()}).on('head',{element:e=>e.append(extra,{html:true})}).on('#app',{element:e=>e.setInnerContent(body,{html:true})}).transform(index)
  const headers=new Headers(rewritten.headers);headers.set('content-type','text/html; charset=utf-8');headers.set('cache-control','no-cache');headers.delete('content-length');headers.delete('etag')
  if(preview||meta.robots.includes('noindex'))headers.set('X-Robots-Tag','noindex, follow');else headers.delete('X-Robots-Tag')
  return new Response(request.method==='HEAD'?null:rewritten.body,{status,headers})
  }
  // Cache only immutable-catalog book/author pages after fresh authoritative
  // visibility checks. Public uploads have a separate generation pipeline.
  if(release&&match&&env.SEO_HTML_CACHE_VERSION){
   if(!/^[a-f0-9]{40,64}$/.test(env.SEO_HTML_CACHE_VERSION))throw Error('seo_cache_version')
   return await serveVersionedPublicHtml({request,cache:caches.default,deploymentVersion:env.SEO_HTML_CACHE_VERSION,
    loadSnapshot:async()=>{
     if(status!==200||!baseRecord)return null
     const current=await refreshPublicSeoRecord(env.VISITORS_DB,match[1],baseRecord.id,baseRecord)
     if(!current)return null
     const currentListing=listKey?await release.listing(listKey,seoListingPage(url)):undefined
     if(listKey&&!currentListing)return null
     const related=await loadRelated(current)
     return{public:true,versionMaterial:{release:env.SEO_DATA_RELEASE_SHA256,record:current,listing:currentListing,related},record:current,listing:currentListing,related}
    },render:snapshot=>renderPage(snapshot?.record,snapshot?200:404,snapshot?.listing,snapshot?.related),
    ...(context.waitUntil?{waitUntil:promise=>context.waitUntil(promise)}:{})})
  }
  return await renderPage(record,status,listing,await loadRelated(record))
 }catch(error){console.error('seo_render_failed',error instanceof Error?error.message:'unknown');return new Response('تعذّر تحميل الصفحة مؤقتًا',{status:503,headers:{'content-type':'text/plain; charset=utf-8','X-Robots-Tag':'noindex','cache-control':'no-store'}})}
}
