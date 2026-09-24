import {it,expect} from 'vitest'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import data from './quran_fath_reviewed_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import {fathReviewedLink,getFathReviewedLink} from './quran_fath_reviewed_links'
import {getSourceEditionBookLink} from './quran_source_book_links'
import {normalized} from '../../tools/build-source-edition-book-links.mjs'
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8')),sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex')
it('adds exactly the thirteen previously unmapped Fath keys and keeps prior links unchanged',()=>{
 const published=read('artifacts/shuoun-tafsir-20260912/published17-acceptance-20260914.json'),edition=published.editions.find((e:any)=>e.slug==='fath-al-qadir')
 expect(data.anchors.map(a=>`${a.surah}:${a.ayah}`).sort()).toEqual([...edition.missing].sort());expect(data.anchors).toHaveLength(13)
 for(const e of published.editions)for(const a of e.verifiedLinks){const [s,v]=a.key.split(':').map(Number),link=getSourceEditionBookLink(e.slug,s,v)!;expect([link.bookId,link.pageIndex,link.sourceRowId,link.sharedRange]).toEqual([a.bookId,a.pageIndex,a.sourceRowId,a.sharedRange])}
 for(const a of data.anchors)expect(getSourceEditionBookLink('fath-al-qadir',a.surah,a.ayah)).toEqual(getFathReviewedLink('fath-al-qadir',a.surah,a.ayah))
})
it('retains exact original sections, source texts and two unique literal witnesses per key',()=>{
 const proof=read('artifacts/shuoun-tafsir-20260912/fath-reversed-title-reviewed-20260914.json'),bytes=fs.readFileSync('D:/alkhizana/بيانات-المشروع/shamela/published-corpus-v1/batch-0061/books/23623.json'),book=JSON.parse(bytes.toString()),all=normalized(book.pages.map((p:any)=>p.body).join(''));expect(sha(bytes)).toBe(data.bookSha256)
 for(const a of data.anchors){const r=proof.anchors.find((r:any)=>r.surah===a.surah&&r.ayah===a.ayah);expect(sha(JSON.stringify(r))).toBe(a.evidenceSha256);expect(book.titles.find((t:any)=>t.sourceRowId===a.titleId)).toEqual(r.title)
  for(const p of r.sectionPages)expect(sha(book.pages[p.pageIndex].body)).toBe(p.bodySha256)
  const pack=read(`app/public/quran/resources/source-editions/fath-al-qadir/${a.surah}.json`),record=pack.records.find((r:any)=>r.ayah===a.ayah),source=(record.fragmentRefs?.map((i:number)=>pack.fragments[i])??record.sourceSegments).map((s:any)=>s.text).join('<hr>');expect(sha(source)).toBe(a.sourceTextSha256)
  expect(r.witnesses).toHaveLength(2);for(const w of r.witnesses){expect(normalized(source).slice(w.sourceOffset,w.sourceOffset+160)).toBe(w.excerpt);expect(all.split(w.excerpt)).toHaveLength(2)}
 }
})
it('never reverses arbitrary titles or accepts another edition, page or range',()=>{
 const a=data.anchors[0]!,run=(review:any)=>fathReviewedLink(review,definitions,'fath-al-qadir',a.surah,a.ayah)
 for(const patch of [{titleId:'999'},{from:a.to,to:a.from},{pageIndex:a.pageIndex+1},{sourceRowId:'999'},{evidenceSha256:''}])expect(run({...data,anchors:[{...a,...patch}]})).toBeUndefined()
 expect(run({...data,anchors:[a,a]})).toBeUndefined();expect(run({...data,sourceManifestSha256:'0'.repeat(64)})).toBeUndefined();expect(run({...data,bookSha256:'0'.repeat(64)})).toBeUndefined()
 expect(getFathReviewedLink('fath-al-qadir',2,19)).toBeUndefined();expect(getFathReviewedLink('manar',2,17)).toBeUndefined()
})
