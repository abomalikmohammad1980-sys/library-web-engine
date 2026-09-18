import {it,expect} from 'vitest'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import data from './quran_mathoor_reviewed_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import {mathoorReviewedLink,getMathoorReviewedLink} from './quran_mathoor_reviewed_links'
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8')),sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex'),out='artifacts/shuoun-tafsir-20260912/'
const proof=read(out+'mathoor-missing-links-reviewed-20260914.json'),previous=read(out+'mathoor-verified-anchors.json'),defs=[{slug:'shuoun-mathoor',bookId:639,manifestSha256:data.sourceManifestSha256}]
it('preserves the 33 reviewed destinations in the now-published Mathoor source',()=>{
 expect(data.anchors).toHaveLength(33);expect(data.anchors.map(a=>`${a.surah}:${a.ayah}`).sort()).toEqual([...previous.missing].sort());expect(previous.tocAnchors).toHaveLength(6203)
 expect(definitions.find(d=>d.slug==='shuoun-mathoor')).toMatchObject(defs[0]!)
 for(const a of data.anchors){const link=mathoorReviewedLink(data,defs,'shuoun-mathoor',a.surah,a.ayah)!,p=proof.anchors.find((p:any)=>p.key===`${a.surah}:${a.ayah}`);expect(getMathoorReviewedLink('shuoun-mathoor',a.surah,a.ayah)).toEqual(link);expect([link.bookId,link.pageIndex,link.sourceRowId]).toEqual(['410000639',p.pageIndex,p.sourceRowId]);expect(link.sharedRange).toEqual(a.from<a.to?{surah:a.surah,from:a.from,to:a.to}:undefined)}
})
it('rechecks original identities, exact source text and existing destination evidence',()=>{
 const bytes=fs.readFileSync('D:/alkhizana/بيانات-المشروع/shamela/published-corpus-v1/batch-0006/books/639.json'),book=JSON.parse(bytes.toString());expect(sha(bytes)).toBe(data.originalBookSha256)
 expect(sha(fs.readFileSync(out+'verified-packs/shuoun-mathoor/manifest.json'))).toBe(data.sourceManifestSha256)
 for(const a of proof.anchors){const r=read(out+'mathoor/'+a.key.replace(':','-')+'.json');expect(sha(r.text)).toBe(a.sourceTextSha256);expect(book.pages[a.pageIndex].sourceRowId).toBe(a.sourceRowId)
  if(a.evidence.kind==='explicit-source-group-to-verified-original-verse'){const old=previous.tocAnchors.find((p:any)=>`${p.surah}:${p.ayah}`===a.evidence.verifiedOriginalKey);expect(old).toEqual(a.evidence.verifiedOriginalAnchor);expect([old.pageIndex,old.sourceRowId]).toEqual([a.pageIndex,a.sourceRowId]);const other=read(out+'mathoor/'+a.evidence.verifiedOriginalKey.replace(':','-')+'.json');expect(other.text).toContain(`href="sura${a.surah}-aya${a.ayah}.html#tafsir"`)}
  if(a.evidence.kind==='explicit-source-reference-to-verified-group'){const [s,v]=a.evidence.target.split(':');expect(r.text).toContain(`href="sura${s}-aya${v}.html#tafsir"`);expect([a.evidence.targetAnchor.pageIndex,a.evidence.targetAnchor.sourceRowId]).toEqual([a.pageIndex,a.sourceRowId])}
  if(a.evidence.kind==='unique-original-numbered-report-and-source-verse-heading'){expect(sha(book.pages[a.pageIndex].body)).toBe(a.evidence.bodySha256);if(a.evidence.nextBodySha256)expect(sha(book.pages[a.pageIndex+1].body)).toBe(a.evidence.nextBodySha256);expect(a.evidence.witness.length).toBeGreaterThanOrEqual(80);expect(r.text).toContain(a.evidence.sourceWitness)}
 }
})
it('rejects different editions, adjacent substitutions, duplicates and invalid range evidence',()=>{
 const a=data.anchors[0]!,run=(d:any,registry:any=defs)=>mathoorReviewedLink(d,registry,'shuoun-mathoor',a.surah,a.ayah)
 for(const patch of [{sourceManifestSha256:'0'.repeat(64)},{bookId:'410000640'},{originalBookSha256:'0'.repeat(64)},{anchors:[a,a]}])expect(run({...data,...patch})).toBeUndefined()
 for(const patch of [{pageIndex:-1},{from:a.ayah+1},{to:a.ayah-1},{sourceTextSha256:'bad'},{evidenceKind:'nearest-page'}])expect(run({...data,anchors:[{...a,...patch}]})).toBeUndefined()
 expect(run(data,[{...defs[0],bookId:640}])).toBeUndefined()
 for(const a of data.anchors)for(const n of [a.ayah-1,a.ayah+1]){const wanted=data.anchors.find(p=>p.surah===a.surah&&p.ayah===n);expect(mathoorReviewedLink(data,defs,'shuoun-mathoor',a.surah,n)?.pageIndex).toBe(wanted?.pageIndex)}
})
it('four numbered witnesses are unique in the original and retain their literal source opening',async()=>{
 const {normalized}=await import('../../tools/build-source-edition-book-links.mjs'),book=read('D:/alkhizana/بيانات-المشروع/shamela/published-corpus-v1/batch-0006/books/639.json'),numbers=(s:string)=>s.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
 const selected=proof.anchors.filter((a:any)=>a.evidence.kind==='unique-original-numbered-report-and-source-verse-heading');expect(selected).toHaveLength(4)
 for(const a of selected){const e=a.evidence,hits:any[]=[];for(const [i,p]of book.pages.entries()){const m=numbers(p.body??'').match(new RegExp('(?:^|[\\r\\n])\\s*'+e.reportNumber+'\\s*[-–]'));if(m)hits.push({i,offset:m.index})}expect(hits).toHaveLength(1);expect(hits[0].i).toBe(a.pageIndex);const text=book.pages[a.pageIndex].body.slice(hits[0].offset)+(e.nextBodySha256?book.pages[a.pageIndex+1].body:'');expect(normalized(text).startsWith(e.witness)).toBe(true);expect(normalized(e.sourceWitness).slice(0,120)).toBe(e.witness)}
})
