// Derived public accelerator. Read and SHA-verify the complete source posting;
// verify every inserted position again before writing any deployable descriptor.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {build} from 'esbuild'
import {localSearchFetch} from './audit-server-search-prototype.mjs'
const word=process.argv[2];if(!word||!/^[\u0621-\u064a]+$/.test(word))throw Error('normalized_word_required')
const sha=b=>createHash('sha256').update(b).digest('hex'),fixture=JSON.parse(await readFile('.artifacts/batch13/snippet-browser-fixture.json','utf8'))
await build({stdin:{contents:"export {ShamelaSearchV2Client} from './app/src/shamela_search_v2.ts';export {addPosition,mayContainPosition} from './app/src/search_position_filter.ts'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'.artifacts/build-position-client.mjs'})
const {ShamelaSearchV2Client,addPosition,mayContainPosition}=await import('../.artifacts/build-position-client.mjs'),adapter=await localSearchFetch(fixture.source.releaseRoot,fixture.source.manifestPath)
globalThis.__SHAMELA_SEARCH_V2_PACKED__=adapter.config
const client=new ShamelaSearchV2Client(adapter.fetcher),manifest=await client.getPackedManifest(),entry=await client.packedTermEntry(word,manifest),posting=await client.packedTermValue(word,manifest,entry)
const positions=posting[1].reduce((n,row)=>n+row[1].length,0),bytes=new Uint8Array(Math.ceil(positions*16/8))
if(bytes.length>16*1024*1024)throw Error('filter_budget')
for(const row of posting[1])for(const p of row[1]){if(!Number.isSafeInteger(p)||p<0)throw Error('source_position');addPosition(bytes,row[0],p)}
let checked=0
for(const row of posting[1])for(const p of row[1]){if(!mayContainPosition(bytes,row[0],p))throw Error('false_negative');checked++}
const pin=sha(bytes),root='release-artifacts/position-filter-'+pin,parts=[];await mkdir(root,{recursive:true})
for(let i=0;i<bytes.length;i+=1024*1024){const part=bytes.slice(i,i+1024*1024),path=String(parts.length).padStart(3,'0')+'.bin';await writeFile(root+'/'+path,part);parts.push({path,byteLength:part.length,sha256:sha(part)})}
const descriptor={word,releaseId:manifest.releaseId,sourceManifestSha256:sha(await readFile(fixture.source.manifestPath)),termSha256:entry.sha256,sha256:pin,byteLength:bytes.length,parts}
await writeFile(root+'/descriptor.json',JSON.stringify(descriptor,null,2));await writeFile(root+'/proof.json',JSON.stringify({sourceRows:posting[1].length,positions,checked,falseNegatives:0,originalTermBytes:entry.byteLength,filterBytes:bytes.length,sourceVerifiedByClient:true},null,2));console.log(JSON.stringify({root,...descriptor,checked}))
