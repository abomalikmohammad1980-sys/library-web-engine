// Mechanical merge from the previously accepted publication, never from downloads.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const base='.artifacts/batch25/app/src/',live='.artifacts/batch54/deploy/pages-dist/',root='app/src/'
const read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex')
const old=read(base+'quran_source_editions.generated.json'),current=read(root+'quran_source_editions.generated.json'),packs=read(base+'quran_source_packs.generated.json')
const restore=new Set(['shuoun-mathoor','abu-saud','durr-masun','nazm-durar','mawardi','ibn-arabi-ahkam','tarifi','fath-al-qadir'])
let checked=0
for(const d of old.filter(d=>restore.has(d.slug))){
 const prefix='quran/resources/source-editions/'+d.slug+'/'
 assert.equal(sha(fs.readFileSync(live+prefix+'manifest.json')),d.manifestSha256)
 const buffers=new Map()
 for(const file of d.files){const part=packs[d.slug][file.file];assert(part);if(!buffers.has(part.path))buffers.set(part.path,fs.readFileSync(live+prefix+part.path));const data=buffers.get(part.path).subarray(part.offset,part.offset+part.bytes);assert.equal(data.length,file.byteSize);assert.equal(sha(data),file.checksumSha256);checked++}
}
const updates=new Map()
updates.set('quran_source_editions.generated.json',[...current.filter(d=>!restore.has(d.slug)),...old.filter(d=>restore.has(d.slug))])
const nextPacks=read(root+'quran_source_packs.generated.json'),links=read(root+'quran_source_book_links.generated.json'),oldLinks=read(base+'quran_source_book_links.generated.json')
for(const slug of restore){nextPacks[slug]=packs[slug];if(oldLinks.editions[slug])links.editions[slug]=oldLinks.editions[slug]}
updates.set('quran_source_packs.generated.json',nextPacks);updates.set('quran_source_book_links.generated.json',links)
const excerpts=read(root+'quran_reviewed_excerpts.generated.json'),oldExcerpts=read(base+'quran_reviewed_excerpts.generated.json')
for(const row of oldExcerpts.records){if(!restore.has(row.slug))continue;excerpts.records=excerpts.records.filter(r=>!(r.slug===row.slug&&r.surah===row.surah&&r.ayah===row.ayah));excerpts.records.push(row)}
updates.set('quran_reviewed_excerpts.generated.json',excerpts)
if(process.argv.includes('--apply'))for(const [file,data]of updates)fs.writeFileSync(root+file,JSON.stringify(data)+'\n')
console.log(JSON.stringify({checkedSurahs:checked,restored:[...restore],sourceEditions:updates.get('quran_source_editions.generated.json').length,applied:process.argv.includes('--apply')}))
