import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {build} from 'esbuild'

const root=resolve(import.meta.dirname,'..')
const packageRoot=resolve(root,'artifacts/six-requested-tafsirs-20260915/review-package')
const handoffBytes=await readFile(resolve(packageRoot,'handoff.json'))
const handoff=JSON.parse(handoffBytes)
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const overrides=new Map()
for(const item of handoff.sourceOverrides){
 const bytes=await readFile(item.source)
 assert.equal(sha(bytes),item.sha256,'source override changed: '+item.target)
 overrides.set(resolve(root,item.target).replaceAll('\\','/'),bytes.toString('utf8'))
}
const compiled=await build({entryPoints:[resolve(root,'app/src/quran_source_book_links.ts')],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'reviewed-tafsir-overrides',setup(builder){builder.onLoad({filter:/\.(?:ts|json)$/},args=>{const text=overrides.get(args.path.replaceAll('\\','/'));return text===undefined?undefined:{contents:text,loader:args.path.endsWith('.json')?'json':'ts'}})}}]})
const {getSourceEditionBookLink}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const unavailable={mawardi:['3:152','26:55','26:61','34:16','37:70','37:162','82:2'],'durr-masun':['3:163','9:11','9:82']}
const links=JSON.parse(overrides.get(resolve(root,'app/src/quran_source_book_links.generated.json').replaceAll('\\','/')))
let verified=0
for(const source of handoff.sources){
 const entries=Object.entries(links.editions[source.slug])
 assert.equal(entries.length,source.linked)
 for(const [key,row] of entries){
  const [surah,ayah]=key.split(':').map(Number),link=getSourceEditionBookLink(source.slug,surah,ayah)
  assert(link,'missing verified destination: '+source.slug+'/'+key)
  assert.equal(link.bookId,String(row[0]));assert.equal(link.pageIndex,row[1]);assert.equal(link.href,`#/reader/${row[0]}?pageIndex=${row[1]}`)
  verified++
 }
 assert.equal(source.unlinked,unavailable[source.slug]?.length??0)
}
for(const [slug,keys] of Object.entries(unavailable))for(const key of keys){
 const [surah,ayah]=key.split(':').map(Number)
 assert.equal(getSourceEditionBookLink(slug,surah,ayah),undefined,'unexpected active fallback: '+slug+'/'+key)
}
const display=overrides.get(resolve(root,'app/src/screens/quran.ts').replaceAll('\\','/'))
assert(display.includes("sourceBookLink?.href:tafsirReaderHref"),'unverified destination must not fall back to a reader URL')
assert(display.includes("bookHref?[h('a',")&&display.includes(":[h('span',{class:'muted',title:'لم يثبت موضع هذه الآية في نسخة المكتبة بعد'},'موضع الكتاب غير موثّق')]") ,'missing destinations must render as noninteractive text')
assert.equal(verified,25056)
const result={checkedAt:new Date().toISOString(),passed:true,published:false,handoffSha256:sha(handoffBytes),verifiedLinks:verified,unlinkedCount:10,unlinked:unavailable,displayPolicy:'Keep commentary visible. Render no anchor or reader fallback for the ten unverified destinations. Other verified destinations remain active.',userAuthorization:'2026-09-16: user explicitly accepts publication with these ten library links inactive.',releaseGate:'The missing destinations are accepted exceptions, not a claim of complete book-link coverage. Overall deployment verification remains required.'}
await writeFile(resolve(packageRoot,'unlinked-publication-acceptance.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result))
