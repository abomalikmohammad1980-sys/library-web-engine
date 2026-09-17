import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {ShamelaSearchV2Client} from '../app/src/shamela_search_v2'
import {materializeShamelaPackBook} from '../app/src/shamela_pack_seed'
import {revalidateBokAnnotations} from '../app/src/bok_annotation_revalidation'
import {pinBokActiveRelease,activeBokReaderEntry} from '../app/src/bok_active_release'
const origin='https://khizana-bok-acceptance-20260917.pages.dev',sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex')
let networkRequests=0
const remoteFetch:typeof fetch=async(input,init)=>{const u=new URL(String(input),origin);assert.equal(u.origin,origin);networkRequests++;return fetch(u,{...init,signal:AbortSignal.timeout(20000)})}
async function reader(file:string){const r=await remoteFetch(origin+'/fixture/'+file);assert.equal(r.status,200);const bytes=new Uint8Array(await r.arrayBuffer());return materializeShamelaPackBook(JSON.parse(new TextDecoder().decode(bytes)),bytes,sha(bytes))}
const before=await reader('original.json'),after=await reader('corrected.json')
assert.equal(before.bokPages?.[0]?.text,'اللفظ القديم');assert.equal(after.bokPages?.[0]?.text,'اللفظ المصحح');assert.equal(after.bokPages?.[0]?.id,17)
const search=async(which:string,q:string)=>{
 Object.defineProperty(globalThis,'__SHAMELA_SEARCH_V2_PACKED__',{configurable:true,value:{controlBaseUrl:origin+`/fixture/${which}/control`,projectBaseUrls:[origin+`/fixture/${which}/project-0`]}})
 return new ShamelaSearchV2Client(remoteFetch).searchComplete(q,0,100)
}
assert.equal((await search('old','القديم')).total,1)
if(process.argv.includes('--pinned')){
 Object.defineProperty(globalThis,'location',{configurable:true,value:{origin,hostname:new URL(origin).hostname}})
 Object.defineProperty(globalThis,'__BOK_RELEASES_ENABLED__',{configurable:true,value:true})
 const pinned=await pinBokActiveRelease(remoteFetch);assert.ok(pinned)
 const entry=await activeBokReaderEntry('93',remoteFetch);assert.equal(entry?.entry.bookId,'93');assert.ok(entry?.root.startsWith(pinned.artifactRoot))
}
const corrected=await search('new','المصحح');assert.equal(corrected.total,1);assert.equal(corrected.hits[0]?.text,after.bokPages?.[0]?.text)
assert.equal((await search('new','القديم')).total,0);assert.equal((await search('new','ثابت')).total,1)
const state:any={bookmarks:{[before.id]:[0]},notes:[{bookId:before.id,pageIndex:0,text:'ملاحظتي'}],highlights:[{bookId:before.id,pageIndex:0,text:'القديم',occurrence:0},{bookId:before.id,pageIndex:0,text:'اللفظ',occurrence:0}]}
const checked=revalidateBokAnnotations(state,before,after)
assert.equal(checked.highlights[0]?.sourceReviewRequired,true);assert.equal(checked.highlights[1]?.sourceReviewRequired,undefined);assert.deepEqual(checked.bookmarks,state.bookmarks);assert.deepEqual(checked.notes,state.notes)
const receipt={passed:true,testedAt:new Date().toISOString(),origin,networkRequests,realConsumer:'ShamelaSearchV2Client',realReader:'materializeShamelaPackBook',annotationRevalidation:true,documentPinned:process.argv.includes('--pinned'),fixtureBooks:2,productionActivated:false,fullLibrary:false}
await writeFile('.artifacts/bok-cloud-acceptance-20260917/'+(receipt.documentPinned?'pinned-reader-search-receipt.json':'reader-search-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2))
