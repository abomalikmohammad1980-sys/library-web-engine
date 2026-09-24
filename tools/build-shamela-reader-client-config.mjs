#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {readFile,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')

/** Pin the small reader routes in the app build, avoiding the large project
 * manifest before the first page. Shard/index bytes retain their own digests. */
export async function buildShamelaReaderClientConfig({releaseManifest,sidecars,baseUrl}){
 const release=JSON.parse(await readFile(resolve(releaseManifest),'utf8'))
 const catalogBytes=await readFile(join(resolve(sidecars),'catalog.json'))
 const catalog=JSON.parse(catalogBytes.toString('utf8'))
 const project=release.projects?.find(item=>item.name==='reader-01'&&item.group==='corpus')
 if(release.contract!=='alkhizana-pages-static-release/1'||!/^[a-f0-9]{24}$/u.test(release.releaseId)||!project||catalog.contract!=='shamela-reader-shards/catalog-1'||!Array.isArray(catalog.books))throw Error('reader_client_config_source_invalid')
 const url=new URL(baseUrl)
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('reader_client_config_base_invalid')
 const routeSha256={}
 for(const book of catalog.books){
  if(!/^batch-\d{4}$/u.test(book.batchId)||!/^\d+$/u.test(book.bookId))throw Error('reader_client_config_route_invalid')
  const path=`${book.batchId}/books/${book.bookId}/route.json`
  routeSha256[path]=sha(await readFile(join(resolve(sidecars),...path.split('/'))))
 }
 return {contract:'alkhizana-pages-client/1',releaseId:release.releaseId,corpusFallback:'same-origin',searchFallback:'same-origin',projects:[{name:project.name,group:'corpus',baseUrl:url.href.replace(/\/+$/u,'')}],directReaderShards:{project:project.name,catalogSha256:sha(catalogBytes),routeSha256}}
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 const args=new Map();for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(key.startsWith('--'))args.set(key,process.argv[++i])}
 if(!args.get('--release')||!args.get('--sidecars')||!args.get('--base-url')||!args.get('--output'))throw Error('usage: --release release-manifest.json --sidecars PATH --base-url URL --output config.json')
 buildShamelaReaderClientConfig({releaseManifest:args.get('--release'),sidecars:args.get('--sidecars'),baseUrl:args.get('--base-url')}).then(async config=>{await writeFile(resolve(args.get('--output')),JSON.stringify(config)+'\n');console.log(JSON.stringify({output:resolve(args.get('--output')),releaseId:config.releaseId,books:Object.keys(config.directReaderShards.routeSha256).length}))},error=>{console.error(error);process.exitCode=1})
}
