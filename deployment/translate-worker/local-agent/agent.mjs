import { setTimeout as sleep } from 'node:timers/promises'
import { apiClient, hello, processJob, verifyLlama } from './client.mjs'
import { UTF8_PROBE } from '../src/local-policy.mjs'

const controller=new AbortController()
process.once('SIGINT',()=>controller.abort())
process.once('SIGTERM',()=>controller.abort())
let api
let shard=0, current=null, lastStatus=0
async function progress(force=false) {
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
  const item=current?.units?.[0]?.text?.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,100) || current?.id || '-'
  console.log(`current language=${current?.target || '-'} | current item=${item} | source=${current?.sourceType || '-'}`)
  for (const failed of stats.failedItems.slice(0,5)) console.log(`Failed: ${failed.target} | ${failed.id} | ${failed.error}`)
}
try {
  api=apiClient(process.env.LOCAL_TRANSLATION_URL,process.env.LOCAL_TRANSLATION_AGENT_TOKEN)
  delete process.env.LOCAL_TRANSLATION_AGENT_TOKEN
  const model=await verifyLlama()
  console.log(`UTF-8 OK: ${UTF8_PROBE}\nModel: ${model}\nProgress is stored in Cloudflare. Ctrl+C stops safely.`)
  await api('heartbeat',hello,controller.signal)
  await progress(true)
  while (!controller.signal.aborted) {
    try {
      await verifyLlama()
      const response=await api('pull',{...hello,shard},controller.signal)
      shard=response.nextShard
      current=response.job
      if (!current || current.skipped) {
        const skipped=current?.skipped
        current=null
        await progress()
        await sleep(skipped ? 100 : 5000,undefined,{signal:controller.signal})
        continue
      }
      await progress(true)
      const jobController=new AbortController()
      const jobSignal=AbortSignal.any([controller.signal,jobController.signal])
      // One sequential heartbeat loop; no overlapping requests or unhandled promises.
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
      current=null
      await progress(true)
    } catch(error) {
      if (controller.signal.aborted) break
      console.error(`Paused: ${error.message}. Will retry; Cloudflare keeps progress.`)
      if ([401,403,404].includes(error.status)) throw error
      await sleep(10000,undefined,{signal:controller.signal})
    }
  }
} catch(error) {
  if (!controller.signal.aborted) { console.error(error.message); process.exitCode=1 }
} finally {
  controller.abort()
  console.log('Stopped. Any interrupted lease becomes available again within 3 minutes.')
}
