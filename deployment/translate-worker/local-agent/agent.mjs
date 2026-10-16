import { setTimeout as sleep } from 'node:timers/promises'
import { apiClient, hello, processJob, verifyLlama } from './client.mjs'
import { configuredConcurrency, memoryCapacity } from './capacity.mjs'
import { UTF8_PROBE } from '../src/local-policy.mjs'

const controller=new AbortController()
process.once('SIGINT',()=>controller.abort())
process.once('SIGTERM',()=>controller.abort())
let api, maximum
let lastStatus=0, progressRequest=null, lastPresence=0, lastCapacity=null
const currents=new Map()
async function renderProgress(force=false) {
  if (!force && Date.now()-lastStatus<30000) return
  const stats=await api('status',undefined,controller.signal)
  if (stats.utf8Probe!==UTF8_PROBE) throw Error('Cloudflare UTF-8 check failed')
  lastStatus=Date.now()
  console.log(`Cloudflare | completed=${stats.completed} | pending=${stats.pending} | processing=${stats.processing} | failed=${stats.failed} | throughput=${stats.completedLastMinute}/min`)
  if (stats.library?.byLanguage) {
    const counts=Object.values(stats.library.byLanguage)
    const ready=counts.reduce((sum,row)=>sum+row.ready,0), remaining=counts.reduce((sum,row)=>sum+row.remaining,0)
    console.log(`Library (all devices, ${stats.library.languages} languages) | ready=${ready} | remaining=${remaining} | sources=${stats.library.sources} | ${(100*ready/Math.max(1,ready+remaining)).toFixed(2)}%`)
    console.log(`Automatic catalog -> local agent: ${stats.automaticEnabled ? 'enabled' : 'disabled (sample stage)'}`)
  }
  for (const current of (currents.size ? currents.values() : [null])) {
    const item=current?.units?.[0]?.text?.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,100) || current?.id || '-'
    console.log(`current language=${current?.target || '-'} | current item=${item} | source=${current?.sourceType || '-'}`)
  }
  for (const failed of stats.failedItems.slice(0,5)) console.log(`Failed: ${failed.target} | ${failed.id} | ${failed.error}`)
}
async function progress(force=false) {
  if(progressRequest)return progressRequest
  progressRequest=renderProgress(force)
  try {await progressRequest} finally {progressRequest=null}
}
async function runLane(lane,model) {
  let shard=lane,current=null
  while (!controller.signal.aborted) {
    try {
      const capacity=memoryCapacity(maximum)
      if(capacity!==lastCapacity){console.log(`Memory guard | maximum=${maximum} | new-work capacity=${capacity}`);lastCapacity=capacity}
      if(lane>=capacity){
        if(Date.now()-lastPresence>25000){lastPresence=Date.now();await api('heartbeat',hello,controller.signal)}
        await progress()
        await sleep(3000,undefined,{signal:controller.signal})
        continue
      }
      await verifyLlama()
      const response=await api('pull',{...hello,shard},controller.signal)
      shard=response.nextShard
      current=response.job
      if (!current || current.skipped) {
        const skipped=current?.skipped
        current=null;currents.delete(lane)
        await progress()
        await sleep(skipped ? 100 : 5000,undefined,{signal:controller.signal})
        continue
      }
      currents.set(lane,current)
      await progress(true)
      const jobController=new AbortController()
      const jobSignal=AbortSignal.any([controller.signal,jobController.signal])
      const renewController=new AbortController()
      const renewal=(async()=>{
        try {
          while(!renewController.signal.aborted) {
            await sleep(25000,undefined,{signal:renewController.signal})
            await api('renew',{id:current.id,token:current.token},jobSignal)
            await api('heartbeat',hello,jobSignal)
          }
        } catch(error) { if(!renewController.signal.aborted) jobController.abort(error) }
      })()
      try {
        await processJob(current,api,model,jobSignal,fetch,unit=>console.log(`Translating ${current.target} | ${current.id.slice(0,16)} | part ${unit.index+1}`))
      } finally { renewController.abort(); await renewal }
      current=null;currents.delete(lane)
      await progress(true)
    } catch(error) {
      currents.delete(lane)
      if (controller.signal.aborted) break
      console.error(`Paused: ${error.message}. Will retry; Cloudflare keeps progress.`)
      if ([401,403,404].includes(error.status)) {controller.abort();throw error}
      try {await sleep(10000,undefined,{signal:controller.signal})}catch{if(!controller.signal.aborted)throw error}
    }
  }
}
try {
  maximum=configuredConcurrency()
  api=apiClient(process.env.LOCAL_TRANSLATION_URL,process.env.LOCAL_TRANSLATION_AGENT_TOKEN)
  delete process.env.LOCAL_TRANSLATION_AGENT_TOKEN
  const model=await verifyLlama()
  console.log(`UTF-8 OK: ${UTF8_PROBE}\nModel: ${model}\nMaximum local concurrency: ${maximum}; memory guard enabled.\nProgress is stored in Cloudflare. Ctrl+C stops safely.`)
  const results=await Promise.allSettled(Array.from({length:maximum},(_,lane)=>runLane(lane,model)))
  const failure=results.find(result=>result.status==='rejected')
  if(failure){console.error(failure.reason?.message || 'Local lane stopped');process.exitCode=1}
} catch(error) {
  if (!controller.signal.aborted) { console.error(error.message); process.exitCode=1 }
} finally {
  controller.abort()
  console.log('Stopped. Any interrupted lease becomes available again within 3 minutes.')
}
