import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const corpus=process.env.KHIZANA_TAFSIR_CORPUS||'D:/alkhizana/بيانات-المشروع/shamela/published-corpus-v1'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
export const normalizedWithHamza=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ').normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\u0621-\u063A\u0641-\u064A]/g,'')
export const normalized=s=>normalizedWithHamza(s).replace(/ء/g,'')
const quoteNorm=s=>normalized(s).replace(/ا/g,'')
export function matchFragment(text,pages,index){
 const n=normalized(text),votes=new Map()
 for(let i=0;i+60<=n.length;i++){for(const p of index.get(n.slice(i,i+20))||[])if(pages[p].normal.includes(n.slice(i,i+60)))votes.set(p,(votes.get(p)||0)+1)}
 return [...votes].filter(([,n])=>n>=2).map(([i])=>i)
}
export function buildIndex(pages){const index=new Map();for(let p=0;p<pages.length;p++){const s=pages[p].normal;for(let i=0;i+20<=s.length;i+=20){const key=s.slice(i,i+20);let set=index.get(key);if(!set)index.set(key,set=new Set());set.add(p)}}return index}
const ids={'tahrir-tanwir':[9776],manar:[12304],'ruh-al-maani':[22835],'wasit-tantawi':[23590],'bahr-muhit':[23591],'qurani-lil-quran':[23607],'fath-al-qadir':[23623],'ibn-juzayy':[23626,30186],kashshaf:[23627],'muharrar-wajiz':[23632]}
export function build(){
 const catalog=read(path.join(root,'app/public/data/shamela-catalog.snapshot.json')).batches.flatMap(b=>b.books.map(x=>({...x,batch:b.id})))
 ids['ibn-uthaymin']=catalog.filter(x=>/^تفسير العثيمين:/.test(x.catalog?.title||'')).map(x=>Number(x.bookId))
 const ayahs=new Map(read(path.join(root,'app/public/quran/full/ayah-text.json')).records.map(a=>[a.ayahId,quoteNorm(a.text)]))
 const selected=process.argv.includes('--slug')?process.argv[process.argv.indexOf('--slug')+1]:undefined
 const outputPath=path.join(root,'app/src/quran_source_book_links.generated.json'),output=fs.existsSync(outputPath)?read(outputPath):{schemaVersion:1,editions:{}};const report={generatedAt:new Date().toISOString(),editions:{}}
 for(const definition of read(path.join(root,'app/src/quran_source_editions.generated.json')).filter(d=>!selected||d.slug===selected)){
  if(!ids[definition.slug])continue
  const mapped=selected?(output.editions[definition.slug]||{}):{},checks={covered:0,matched:0,unmatched:[],verse44:null},books=[]
  for(const id of ids[definition.slug]||[]){const item=catalog.find(x=>Number(x.bookId)===id);if(!item)continue;const bytes=fs.readFileSync(path.join(corpus,item.batch,item.file));if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('book_checksum:'+id);const book=JSON.parse(bytes);books.push({id,pages:book.pages.map((p,i)=>({normal:normalized(p.body),quote:quoteNorm(p.body),i,sourceRowId:p.sourceRowId})),sha256:item.sha256})}
  // Keep memory bounded: index one existing book at a time, never a second corpus copy.
  for(const book of books){const index=buildIndex(book.pages)
   for(const file of definition.files){const data=read(path.join(root,'app/public/quran/resources/source-editions',definition.slug,file.file));const fragments=data.fragments||[];const matches=fragments.map(f=>matchFragment(f.text,book.pages,index))
    for(const record of data.records){const key=data.surah+':'+record.ayah;if(mapped[key])continue;const refs=record.fragmentRefs;const candidates=refs?[...new Set(refs.flatMap(r=>matches[r]))]:[...new Set((record.sourceSegments||[]).flatMap(f=>matchFragment(f.text,book.pages,index)))];const q=ayahs.get(key)||'';if(q.length<18)continue;
     // Require the opening quotation, not an arbitrary later phrase or merely a page number.
     const needle=q.slice(0,Math.min(q.length,45));const exact=candidates.filter(p=>book.pages[p].quote.includes(needle));if(exact.length!==1)continue;const p=book.pages[exact[0]];mapped[key]=[410000000+book.id,p.i,p.sourceRowId]
    }
   }
  }
  for(const file of definition.files){const data=read(path.join(root,'app/public/quran/resources/source-editions',definition.slug,file.file));for(const r of data.records){checks.covered++;if(mapped[data.surah+':'+r.ayah])checks.matched++;else checks.unmatched.push(data.surah+':'+r.ayah)}}
  checks.verse44=mapped['2:44']||null;output.editions[definition.slug]=mapped;report.editions[definition.slug]=checks;console.log(definition.slug,checks.matched+'/'+checks.covered,'2:44',checks.verse44)
 }
 fs.writeFileSync(path.join(root,'app/src/quran_source_book_links.generated.json'),JSON.stringify(output))
 fs.mkdirSync(path.join(root,'.artifacts/source-edition-book-links'),{recursive:true});fs.writeFileSync(path.join(root,'.artifacts/source-edition-book-links/report.json'),JSON.stringify(report,null,2))
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build()
