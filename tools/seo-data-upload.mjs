import {readFile, stat, mkdir, realpath} from 'node:fs/promises'
import {resolve, relative, isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {createSeoS3Transport} from './seo-data-s3-transport.mjs'
import {parseR2Config, journalWriter, safeFailure} from './field-overlay-upload-state.mjs'
export const PIN = '3c6c99ea80fb2f3b723a5c32a5b0eafdb8cbb4c930fcf8172e96c4c27f827d4c'
export const DEFAULT_DIRECTORY = '.artifacts/seo-data-stage-a-20260917-v1'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const KEY = /^seo\/(identity\/[a-f0-9]{64}\.bin|listings\/[a-f0-9]{64}\/lists-\d{3}\.json)$/
async function verified(job) {
  if ((await stat(job.localPath)).size !== job.bytes) throw Error('local_sha')
  const bytes = await readFile(job.localPath)
  if (sha(bytes) !== job.sha256) throw Error('local_sha')
  return bytes
}
export async function planSeoUpload(directory = DEFAULT_DIRECTORY, expectedPin = PIN) {
  const root = await realpath(directory), report = JSON.parse(await readFile(resolve(root, 'report.json'), 'utf8'))
  const descriptor = await readFile(resolve(root, 'descriptor.json'))
  if (report.contract !== 'seo-data-staging/1' || report.descriptorSha256 !== expectedPin || sha(descriptor) !== expectedPin) throw Error('descriptor_pin')
  if (!Array.isArray(report.objects) || report.objects.length > 4096) throw Error('invalid_job')
  const jobs = [], seen = new Set()
  const metadata = JSON.parse(descriptor), listingFiles = []
  for (const item of report.objects) {
    if (!KEY.test(item.key) || seen.has(item.key) || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > 32 * 1024 ** 2) throw Error('invalid_job')
    seen.add(item.key)
    const localPath = await realpath(resolve(root, 'objects', item.key)), rel = relative(root, localPath)
    if (rel.startsWith('..') || isAbsolute(rel)) throw Error('local_path_escape')
    const job = {...item, localPath}; const bytes = await verified(job); jobs.push(job)
    if (item.key.startsWith('seo/listings/')) {
      if (!item.key.startsWith(`seo/listings/${metadata.listings.releaseId}/`)) throw Error('descriptor_pin')
      listingFiles.push([item.key.split('/').at(-1), bytes])
    }
  }
  const listingHash = createHash('sha256')
  for (const [name, bytes] of listingFiles.sort(([a],[b])=>a.localeCompare(b))) listingHash.update(name+'\n').update(bytes)
  if (listingHash.digest('hex') !== metadata.listings.releaseId) throw Error('descriptor_pin')
  for (const pack of [metadata.identities.index, metadata.identities.records]) {
    if (!jobs.some(j=>j.key===pack.objectKey && j.bytes===pack.bytes && j.sha256===pack.sha256)) throw Error('descriptor_pin')
  }
  if (jobs.length !== listingFiles.length + 2) throw Error('invalid_job')
  jobs.sort((a,b) => a.key.localeCompare(b.key))
  jobs.push({key: `seo/descriptors/${expectedPin}.json`, sha256: expectedPin, bytes: descriptor.length, localPath: resolve(root, 'descriptor.json')})
  return {contract:'seo-data-upload/1', bucket:'khzanah-library', descriptorSha256:expectedPin, objectCount:jobs.length, totalBytes:jobs.reduce((n,j)=>n+j.bytes,0), jobs}
}
export async function transferSeoData({plan, transport, journal = {}, persist = async () => {}, maxObjects, maxBytes, freshVerify = false, signal}) {
  if (!Number.isSafeInteger(maxObjects) || maxObjects < 1 || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw Error('limits')
  if (freshVerify && (maxObjects < plan.jobs.length || maxBytes < plan.totalBytes)) throw Error('fresh_verify_requires_full_budget_and_journal')
  let count = 0, bytes = 0
  // Resume receipts are optimization only; complete is exclusively fresh readback.
  for (const job of plan.jobs) {
    signal?.throwIfAborted()
    const local = await verified(job)
    if (!freshVerify && journal[job.key] === job.sha256) continue
    if (count === maxObjects || bytes + job.bytes > maxBytes) break
    let remote = await transport.get(job.key, job.bytes)
    if (remote && (remote.length !== job.bytes || sha(remote) !== job.sha256)) throw Error('immutable_remote_mismatch')
    if (!remote) {
      if (freshVerify) throw Error('fresh_verify_mismatch')
      await transport.put(job.key, local, {ifNoneMatch:'*'})
      remote = await transport.get(job.key, job.bytes)
      if (!remote || remote.length !== job.bytes || sha(remote) !== job.sha256) throw Error('missing_after_put')
    }
    journal[job.key] = job.sha256; await persist(journal); count++; bytes += job.bytes
  }
  const verifiedObjects = plan.jobs.filter(j=>journal[j.key]===j.sha256).length
  return {contract:plan.contract, descriptorSha256:plan.descriptorSha256, complete:freshVerify && count===plan.jobs.length, activated:false, verifiedObjects, totalObjects:plan.jobs.length, processedObjects:count, processedBytes:bytes, freshVerify, checkedAt:new Date().toISOString()}
}
// Dry-run is the default and never reads credentials or writes state. Execute
// and resumes must use the same Windows user to preserve atomic journal access.
export async function runSeoUpload(args = [], {planLocal = planSeoUpload, log = console.log} = {}) {
  const execute = args[0] === '--execute'; if (execute || args[0] === '--plan') args = args.slice(1)
  const options = {}
  for (let i=0;i<args.length;i+=2) { if (!execute || !['--max-objects','--max-bytes','--max-seconds','--fresh-verify'].includes(args[i]) || options[args[i]]!==undefined || args[i+1]===undefined) throw Error('usage'); options[args[i]]=args[i+1] }
  const plan = await planLocal()
  if (!execute) {const {jobs,...summary}=plan; log(JSON.stringify({...summary, dryRun:true})); return summary}
  const maxObjects=Number(options['--max-objects']), maxBytes=Number(options['--max-bytes']), seconds=Number(options['--max-seconds'])
  if (!Number.isSafeInteger(maxObjects)||maxObjects<1||maxObjects>4097||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>200000000||!Number.isSafeInteger(seconds)||seconds<1||seconds>3600||options['--fresh-verify']!==undefined&&options['--fresh-verify']!=='true') throw Error('limits')
  const configPath='C:/Users/Windows_OS/AppData/Roaming/rclone/rclone.conf'
  if ((await stat(configPath)).size>1048576) throw Error('config_size')
  const config=parseR2Config(await readFile(configPath,'utf8')), state=`.artifacts/seo-data-transfer-${plan.descriptorSha256}`
  await mkdir(state,{recursive:true})
  let journal={}
  try {if((await stat(`${state}/journal.json`)).size>2000000)throw Error('journal_size');journal=JSON.parse(await readFile(`${state}/journal.json`,'utf8'));if(!journal||Array.isArray(journal)||typeof journal!=='object')throw Error('journal_invalid')}catch(e){if(e.code!=='ENOENT')throw Error('journal_invalid')}
  const controller=new AbortController(), stop=()=>controller.abort(Error('stopped')), timer=setTimeout(stop,seconds*1000)
  process.once('SIGINT',stop);process.once('SIGTERM',stop)
  const transport=createSeoS3Transport({...config,allowedKeys:plan.jobs.map(j=>j.key),signal:controller.signal,runTimeoutMs:seconds*1000})
  try {
    await journalWriter(`${state}/status.json`,{complete:false,activated:false,descriptorSha256:plan.descriptorSha256})
    const result=await transferSeoData({plan,transport,journal,persist:value=>journalWriter(`${state}/journal.json`,value),maxObjects,maxBytes,freshVerify:options['--fresh-verify']==='true',signal:controller.signal})
    await journalWriter(`${state}/status.json`,result);log(JSON.stringify(result));return result
  } finally {clearTimeout(timer);transport.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)runSeoUpload(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({complete:false,activated:false,failure:safeFailure(error,'seo_upload')}));process.exitCode=1})
