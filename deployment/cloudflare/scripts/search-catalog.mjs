import {mkdir,readFile,writeFile,access,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const origin='https://khzanah.com';
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(path,label)=>`<a href="${escapeHtml(path)}">${escapeHtml(label)}</a>`;
const style=`body{margin:0;background:#f5f1e7;color:#242823;font:18px/1.9 system-ui,sans-serif}main,header,footer{max-width:960px;margin:auto;padding:24px}header,footer{display:flex;gap:24px;flex-wrap:wrap}main{background:white;border-radius:20px;box-sizing:border-box}a{color:#246a50;text-underline-offset:4px}h1{font-size:clamp(1.6rem,5vw,2.5rem);line-height:1.6;overflow-wrap:anywhere}li{padding:10px 0;border-bottom:1px solid #eee}nav{display:flex;gap:20px;flex-wrap:wrap}dl{display:grid;grid-template-columns:auto 1fr;gap:12px}dd{margin:0}main a{overflow-wrap:anywhere}a:focus-visible{outline:3px solid #ac7e28;outline-offset:4px}`;
export function catalogPage(path,title,description,body){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - الخِزانة</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${origin}${path}"><link rel="icon" href="/favicon-64.png"><style>${style}</style></head><body><header>${link('/','الخِزانة')}${link('/catalog/','فهرس الكتب والمؤلفين')}</header><main><h1>${escapeHtml(title)}</h1>${body}</main><footer>${link('/#/library','فتح المكتبة')}${link('/catalog/','تصفح الفهرس')}</footer></body></html>`}

// Only the already-public, release-staged catalog is accepted. Never read account
// submissions, private storage, local uploads, or unreviewed filesystem books.
export function searchCatalogModel(metadata){
 if(!Array.isArray(metadata.authors))throw Error('seo_public_catalog_invalid');
 const authors=[],books=new Map();
 for(const a of metadata.authors){
  if(!/^\d+$/.test(a.authorId)||!a.name||!Array.isArray(a.books))throw Error('seo_author_invalid');
  const author={id:a.authorId,name:a.name,death:a.deathYearHijri,books:[]};
  for(const b of a.books){
   if(!/^\d+$/.test(b.id)||!b.title||!/^batch-\d+$/.test(b.batchId))throw Error('seo_book_invalid');
   let book=books.get(b.id);
   if(!book){book={id:b.id,title:b.title,category:b.category,authors:[]};books.set(b.id,book)}
   if(book.title!==b.title)throw Error('seo_book_identity_conflict');
   if(!book.authors.some(x=>x.id===author.id))book.authors.push(author);
   if(!author.books.some(x=>x.id===book.id))author.books.push(book);
  }
  if(author.books.length)authors.push(author);
 }
 if(new Set(authors.map(a=>a.id)).size!==authors.length)throw Error('seo_duplicate_author');
 return {authors,books:[...books.values()]};
}

export async function stageSearchCatalog(destination){
 const root=resolve(destination),catalogRoot=resolve(root,'catalog');
 // Require a fresh release staging directory: never silently retain removed pages.
 try{await access(catalogRoot);throw Error('seo_catalog_requires_fresh_stage')}catch(e){if(e.code!=='ENOENT')throw e}
 const model=searchCatalogModel(JSON.parse(await readFile(resolve(root,'data/shamela-author-metadata.json'),'utf8')));
 const planned=model.books.length+model.authors.length+Math.ceil(model.books.length/100)+Math.ceil(model.authors.length/100)+1;
 const existing=(await readdir(root,{recursive:true,withFileTypes:true})).filter(x=>x.isFile()).length;
 if(existing+planned>20000)throw Error(`seo_pages_capacity: ${existing}+${planned} exceeds 20000; use reviewed R2 delivery before enabling`);
 const paths=[];
 async function page(path,title,description,body){
  const file=resolve(root,`.${path}`,'index.html');
  if(!file.startsWith(catalogRoot+'/')&&!file.startsWith(catalogRoot+'\\'))throw Error('seo_output_path');
  await mkdir(dirname(file),{recursive:true});await writeFile(file,catalogPage(path,title,description,body));paths.push(path);
 }
 for(const b of model.books){
  const names=b.authors.map(a=>a.name).join('، ');
  await page(`/catalog/books/${b.id}/`,b.title,`${b.title}، تأليف ${names}${b.category?`، ${b.category}`:''}. معلومات الكتاب وقراءته في الخزانة.`,
   `<dl><dt>المؤلف</dt><dd>${b.authors.map(a=>link(`/catalog/authors/${a.id}/`,a.name)).join('، ')}</dd>${b.category?`<dt>التصنيف</dt><dd>${escapeHtml(b.category)}</dd>`:''}</dl><p>${link(`/#/reader/${b.id}`,'قراءة الكتاب')}</p>`);
 }
 for(const a of model.authors)await page(`/catalog/authors/${a.id}/`,a.name,`كتب ${a.name} المتاحة للقراءة في الخزانة.`,
  `${Number.isInteger(a.death)&&a.death>0?`<p>الوفاة: ${a.death} هـ</p>`:''}<p>${link(`/#/people/${a.id}`,'عرض ترجمة المؤلف في المكتبة')}</p><h2>الكتب المتاحة</h2><ul>${a.books.map(b=>`<li>${link(`/catalog/books/${b.id}/`,b.title)}</li>`).join('')}</ul>`);
 for(const [kind,items,label] of [['books',model.books,'الكتب'],['authors',model.authors,'المؤلفون']]){
  const count=Math.ceil(items.length/100);
  for(let n=1;n<=count;n++)await page(`/catalog/${kind}/page/${n}/`,`${label} — صفحة ${n}`,`تصفح ${label} في الخزانة، صفحة ${n}.`,
   `<ul>${items.slice((n-1)*100,n*100).map(x=>`<li>${link(`/catalog/${kind}/${x.id}/`,x.title??x.name)}</li>`).join('')}</ul><nav>${n>1?link(`/catalog/${kind}/page/${n-1}/`,'السابق'):''}${n<count?link(`/catalog/${kind}/page/${n+1}/`,'التالي'):''}</nav>`);
 }
 await page('/catalog/','فهرس الكتب والمؤلفين','فهرس مكتبة الخزانة: تصفح الكتب والمؤلفين وافتح الكتب للقراءة.',`<p>تصفح كتب المكتبة بحسب عناوينها ومؤلفيها.</p><nav>${link('/catalog/books/page/1/',`الكتب (${model.books.length})`)}${link('/catalog/authors/page/1/',`المؤلفون (${model.authors.length})`)}</nav>`);
 const sitemap=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/',...paths.sort()].map(p=>`<url><loc>${origin}${escapeHtml(p)}</loc></url>`).join('')}</urlset>`;
 if(paths.length+1>50000||Buffer.byteLength(sitemap)>50*1024*1024)throw Error('seo_sitemap_limit');
 await writeFile(resolve(root,'sitemap.xml'),sitemap);
 try{
  const homePath=resolve(root,'index.html');let home=await readFile(homePath,'utf8');
  home=home.replace('</body>','<footer dir="rtl" style="text-align:center;padding:1rem"><a href="/catalog/">فهرس الكتب والمؤلفين</a></footer></body>');
  await writeFile(homePath,home);
 }catch(e){if(e.code!=='ENOENT')throw e}
 return {books:model.books.length,authors:model.authors.length,pages:paths.length,sitemapUrls:paths.length+1};
}
