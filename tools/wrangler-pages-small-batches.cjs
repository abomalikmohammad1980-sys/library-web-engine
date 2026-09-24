// Transport-only workaround for repeated ECONNRESET/HeadersTimeout while
// uploading 40 MiB Pages buckets. Do not modify installed Wrangler or auth.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module')
const filename=path.resolve(__dirname,'../alpha-publish/node_modules/wrangler/wrangler-dist/cli.js')
let source=fs.readFileSync(filename,'utf8')
if(crypto.createHash('sha256').update(source).digest('hex')!=='fc1aa72afc91906759a3555e76e6dae1b13504f71dec6d3bbfa0fe24c351ebd7')throw Error('wrangler_version_changed_review_required')
// The 16 MiB experiment registered 2290 hashes but repeatedly failed with
// CURLE_SEND_ERROR (55). Keep checkpointing and return to bounded 4 MiB bodies.
for(const [from,to] of [['MAX_BUCKET_SIZE = 40 * 1024 * 1024;','MAX_BUCKET_SIZE = 4 * 1024 * 1024;'],['BULK_UPLOAD_CONCURRENCY = 3;','BULK_UPLOAD_CONCURRENCY = 3;']]){
 if(source.split(from).length!==2)throw Error('transport_patch_not_unique')
 source=source.replace(from,to)
}
// Wrangler registers reusable hashes only after the entire 4.56 GB transfer.
// Register each successfully uploaded bucket using its existing idempotent API
// so a later network failure no longer discards resume progress. No unuploaded
// hash is registered, and the final normal manifest/deployment flow is intact.
const checkpointAnchor='logger.debug("result:", res);'
const uploadStart=source.indexOf('logger.debug("POST /pages/assets/upload");')
const checkpointAt=source.indexOf(checkpointAnchor,uploadStart)
if(uploadStart<0||checkpointAt<0||checkpointAt-uploadStart>2000)throw Error('upload_checkpoint_anchor_changed')
source=source.slice(0,checkpointAt)+`await fetchResult(COMPLIANCE_REGION_CONFIG_PUBLIC, '/pages/assets/upsert-hashes', {
 method: 'POST', headers: {'Content-Type':'application/json', Authorization: 'Bearer '+jwt},
 body: JSON.stringify({hashes: bucket.files.map(file=>file.hash)})
});\n`+source.slice(checkpointAt)
// curl's native TLS path passed all six read-only endpoint probes while Node
// uploads continue resetting. Keep authentication, hashes and payload identical.
globalThis.__khizanaNativeAssetTransfer=require('./pages-curl-transport.cjs').transfer
// Wrangler's outer attempts variable is shared by all concurrent buckets in
// this pinned version. Give each upload its own retry budget so independent
// transient failures do not exhaust one another's retries and rehash 4.56 GB.
const uploadCallStart=source.indexOf('const res = await fetchResult(',uploadStart)
const uploadCallEnd=source.indexOf('await fetchResult(COMPLIANCE_REGION_CONFIG_PUBLIC,',uploadCallStart)
if(uploadCallStart<0||uploadCallEnd<0||uploadCallEnd-uploadCallStart>2000)throw Error('native_upload_anchor_changed')
const checkpointEnd=source.indexOf('});\n',uploadCallEnd)+4
source=source.slice(0,uploadCallStart)+`const res = await globalThis.__khizanaNativeAssetTransfer('/pages/assets/upload',jwt,payload);
await globalThis.__khizanaNativeAssetTransfer('/pages/assets/upsert-hashes',jwt,{hashes:bucket.files.map(file=>file.hash)});
`+source.slice(checkpointEnd)
const retryAnchor='        attempts = 0;'
const retryAt=source.lastIndexOf(retryAnchor,uploadStart)
if(retryAt<0||uploadStart-retryAt>1600||!source.slice(retryAt,retryAt+70).includes('let gatewayErrors = 0;'))throw Error('bucket_retry_anchor_changed')
source=source.slice(0,retryAt)+source.slice(retryAt).replace(retryAnchor,'        let attempts = 0;')
const reportProgress=process.argv.includes('--report-progress')
const args=process.argv.slice(2).filter(arg=>arg!=='--report-progress')
if(args.join(' ')!=='--version'&&!(args[0]==='pages'&&args[1]==='deploy'))throw Error('only_pages_deploy_allowed')
if(reportProgress){
 const anchor='const missingHashes = await getMissingHashes(args.skipCaching);'
 if(source.split(anchor).length!==2)throw Error('progress_anchor_changed')
 source=source.replace(anchor,anchor+`\nconst absent=new Set(missingHashes),remaining=files.filter(f=>absent.has(f.hash));
console.log(JSON.stringify({checkedAt:new Date().toISOString(),totalFiles:files.length,registeredFiles:files.length-remaining.length,totalBytes:files.reduce((n,f)=>n+f.sizeInBytes,0),remainingBytes:remaining.reduce((n,f)=>n+f.sizeInBytes,0),deploymentCreated:false}));process.exit(0);`)
}
// IPv4 HTTPS succeeded in a read-only probe while automatic address selection
// repeatedly timed out. Scope this to this process; keep TLS verification on.
const undici=require('../alpha-publish/node_modules/undici')
undici.setGlobalDispatcher(new undici.Agent({connect:{family:4,timeout:30000},pipelining:0}))
process.argv=[process.argv[0],filename,...args]
const runner=new Module(filename,module)
runner.filename=filename;runner.paths=Module._nodeModulePaths(path.dirname(filename))
process.mainModule=runner
require.cache[filename]=runner
runner._compile(source,filename)
