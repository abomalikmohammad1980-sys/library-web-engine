// Operator-only importer. Re-running the same UTF-8 NDJSON file is idempotent.
import { createReadStream } from 'node:fs'
import { TextDecoderStream } from 'node:stream/web'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import { apiClient } from './client.mjs'
import { HY_MT_LANGUAGES } from '../src/local-policy.mjs'

const file=process.argv[2]
if (!file) throw Error('Usage: node enqueue.mjs catalog.ndjson OR --retry JOB_ID')
const api=apiClient(process.env.LOCAL_TRANSLATION_URL,process.env.LOCAL_TRANSLATION_ENQUEUE_TOKEN)
delete process.env.LOCAL_TRANSLATION_ENQUEUE_TOKEN
if (file==='--retry') {
  const id=process.argv[3]
  if (!/^[a-f0-9]{64}$/.test(id||'')) throw Error('Expected a failed job ID')
  console.log(await api('retry',{id}))
  process.exit(0)
}
const stream=Readable.fromWeb(Readable.toWeb(createReadStream(file)).pipeThrough(new TextDecoderStream('utf-8',{fatal:true})))
const lines=createInterface({input:stream,crlfDelay:Infinity})
let count=0
for await (const line of lines) {
  if (!line.trim()) continue
  if (line.length>20000) throw Error('Manifest line exceeds the limit')
  const item=JSON.parse(line.replace(/^\uFEFF/,''))
  const targets=item.targetLanguage ? [item.targetLanguage] : Object.keys(HY_MT_LANGUAGES)
  for (const targetLanguage of targets) {
    const result=await api('enqueue',{text:item.text,targetLanguage,purpose:item.purpose||'text',sourceType:item.sourceType||'catalog'})
    console.log(`${++count} | ${targetLanguage} | ${result.cached ? 'reused existing memory' : result.state} | ${result.id || '-'}`)
  }
}
