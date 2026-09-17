import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const root='.artifacts/bok-cloud-acceptance-20260917',owner=JSON.parse(await readFile(root+'/private-job-session.json','utf8')),foreign=JSON.parse(await readFile(root+'/private-edition-foreign-session.json','utf8'))
assert.equal(owner.origin,'https://khizana-bok-acceptance-20260917.pages.dev')
const call=(cookie,id,input)=>fetch(owner.origin+'/api/library/book-editions'+(input?'':'?'+new URLSearchParams({id})),{method:input?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{cookie:cookie??'',origin:owner.origin,'x-alkhizana-request':'account-ui',...(input?{'content-type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})})
for(let i=0;i<2;i++)assert.equal((await call(owner.cookie,'',{bookId:'edition-pdf',parentId:'edition-word'})).status,200)
let value=await(await call(owner.cookie,'edition-word')).json();assert.equal(value.parent.id,'edition-word');assert.equal(value.editions[0].id,'edition-pdf');assert.equal(value.editions[0].edition,'طبعة ثانية')
assert.equal((await call(foreign.cookie,'edition-word')).status,404)
assert.equal((await call(foreign.cookie,'',{bookId:'edition-pdf',parentId:'edition-public-parent'})).status,404)
assert.equal((await call(null,'edition-word')).status,404)
assert.equal((await call(owner.cookie,'',{bookId:'edition-private-sibling',parentId:'edition-public-parent'})).status,200)
for(const cookie of [null,foreign.cookie]){value=await(await call(cookie,'edition-public-parent')).json();assert.equal(value.editions.length,0)}
value=await(await call(owner.cookie,'edition-public-parent')).json();assert.equal(value.editions.length,1)
assert.equal((await call(owner.cookie,'',{bookId:'edition-word',parentId:'edition-public-parent'})).status,404)
const receipt={passed:true,testedAt:new Date().toISOString(),origin:owner.origin,checks:['real owner link','idempotent link','edition metadata','foreign ownership denied','private parent concealed','private sibling concealed from anonymous and other account','owner sees sibling','non-PDF child denied'],realSession:true,accountTestMode:false,productionWrites:0,withdrawalTested:false,assetUploadRoundTrip:false,browserUI:false}
await writeFile(root+'/edition-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2))
