import {readFile,writeFile,mkdir,cp} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
import {PUBLIC_PAGE_META,SEO_SHARD_COUNT,seoShard,plainSeoText} from '../app/src/page_meta_model.ts'
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
export async function buildSeoIndex(output,{tocDirectory,requireToc=false}={}){
 const root=resolve(output),authorBytes=await readFile(resolve(root,'data/shamela-author-index.json')),catalogBytes=await readFile(resolve(root,'data/shamela-catalog.snapshot.json'))
 const index=JSON.parse(authorBytes),catalog=JSON.parse(catalogBytes)
 assert.equal(index.authors.length,index.counts.authors,'author count mismatch')
 assert.equal(index.authors.reduce((n,a)=>n+a.books.length,0),index.counts.books,'author index book count mismatch')
 assert.ok(Number.isFinite(Date.parse(index.generatedAt)),'missing generatedAt')
 const authors=new Map(),books=new Map(),authorBooks=new Map()
 let toc
 if(tocDirectory){
  toc=JSON.parse(await readFile(resolve(tocDirectory,'toc-manifest.json')))
  assert.equal(toc.catalogSha256,createHash('sha256').update(catalogBytes).digest('hex'),'toc catalog changed')
  assert.equal(toc.books,catalog.bookCount);assert.equal(Object.keys(toc.records).length,catalog.bookCount)
 }
 assert(!requireToc||toc,'TOC extraction required before publication')
 for(const author of index.authors){
  assert.match(author.authorId,/^\d{1,12}$/);const id=author.authorId.padStart(6,'0');assert(!authors.has(id),'duplicate author')
  authors.set(id,{id,name:plainSeoText(author.name),biography:plainSeoText(author.biography??'').slice(0,1800),...(author.deathYearHijri>0&&author.deathYearHijri<3000?{deathYearHijri:author.deathYearHijri}:{}),books:author.books.map(b=>({id:String(b.sourceBookId),title:plainSeoText(b.title)}))})
  for(const book of author.books){assert(!authorBooks.has(String(book.sourceBookId)),'duplicate index book');authorBooks.set(String(book.sourceBookId),id)}
 }
 for(const batch of catalog.batches)for(const book of batch.books){
  const id=String(book.bookId),authorId=authorBooks.get(id),author=authors.get(authorId)
  assert.match(id,/^\d{1,12}$/);assert(!books.has(id),'duplicate catalog book');assert(book.catalog?.title&&book.catalog?.author,'missing public book identity')
  if(toc){assert(toc.records[id],'toc record missing:'+id);const pack=toc.packs.find(pack=>pack.path===toc.records[id].path);assert(pack);toc.records[id].objectKey=`seo/toc/${pack.sha256}.bin`}
  books.set(id,{id,title:plainSeoText(book.catalog.title),author:plainSeoText(author?.name??book.catalog.author),...(authorId?{authorId}:{}),category:plainSeoText(book.catalog.category??''),...(author?.deathYearHijri?{deathYearHijri:author.deathYearHijri}:{}),...(toc?{toc:toc.records[id]}:{})})
 }
 assert.equal(books.size,catalog.bookCount,'catalog count mismatch')
 for(const id of authorBooks.keys())assert(books.has(id),'author book absent from catalog')
 const dir=resolve(root,'data/seo');await mkdir(dir,{recursive:true})
 if(toc)for(const pack of toc.packs){assert.match(pack.path,/^toc-\d{3}\.bin$/);const path=resolve(tocDirectory,pack.path),bytes=await readFile(path);assert.equal(bytes.length,pack.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),pack.sha256);await cp(path,resolve(dir,pack.path))}
 const shards=[]
 for(const [kind,rows] of [['authors',authors],['books',books]])for(let i=0;i<SEO_SHARD_COUNT;i++){
  const key=String(i).padStart(2,'0'),records=Object.fromEntries([...rows].filter(([id])=>seoShard(id)===key))
  const bytes=Buffer.from(JSON.stringify({schemaVersion:1,generatedAt:index.generatedAt,records}))
  assert(bytes.length<=1024*1024,`seo shard too large:${kind}/${key}`)
  const name=`${kind}-${key}.json`;await writeFile(resolve(dir,name),bytes);shards.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
 }
 const sitemapNames=[]
 const urls=async(name,paths)=>{
  assert(paths.length<=5000);assert(paths.every(p=>!p.includes('#')&&!p.includes('?')))
  await writeFile(resolve(root,name),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>`<url><loc>https://khzanah.com${xml(p)}</loc><lastmod>${xml(index.generatedAt)}</lastmod></url>`).join('')+'</urlset>');sitemapNames.push(name)
 }
 await urls('sitemap-static.xml',Object.keys(PUBLIC_PAGE_META));await urls('sitemap-authors.xml',[...authors.keys()].sort().map(id=>'/authors/'+id))
 const categories=[...new Set([...books.values()].map(book=>book.category).filter(Boolean))].sort()
 await urls('sitemap-categories.xml',categories.map(name=>'/categories/'+encodeURIComponent(name)))
 const ids=[...books.keys()].sort((a,b)=>Number(a)-Number(b));for(let i=0;i<ids.length;i+=5000)await urls(`sitemap-books-${String(i/5000+1).padStart(3,'0')}.xml`,ids.slice(i,i+5000).map(id=>'/books/'+id))
 await writeFile(resolve(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+sitemapNames.map(name=>`<sitemap><loc>https://khzanah.com/${name}</loc><lastmod>${xml(index.generatedAt)}</lastmod></sitemap>`).join('')+'</sitemapindex>')
 let robots=await readFile(resolve(root,'robots.txt'),'utf8');if(!/^Sitemap:\s*https:\/\/khzanah.com\/sitemap.xml\s*$/mi.test(robots)){robots+='\nSitemap: https://khzanah.com/sitemap.xml\n';await writeFile(resolve(root,'robots.txt'),robots)}
 const report={schemaVersion:1,generatedAt:index.generatedAt,counts:{authors:authors.size,books:books.size,categories:categories.length,authorIndexedBooks:authorBooks.size,staticPages:Object.keys(PUBLIC_PAGE_META).length},sources:{authors:createHash('sha256').update(authorBytes).digest('hex'),catalog:createHash('sha256').update(catalogBytes).digest('hex')},shards,sitemaps:sitemapNames,tocCoverageComplete:Boolean(toc),tocHeadings:toc?.headings??0,tocPacks:toc?.packs??[]}
 await writeFile(resolve(dir,'manifest.json'),JSON.stringify(report));return report
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){assert(process.argv[2],'output required');console.log(JSON.stringify(await buildSeoIndex(process.argv[2])))}
