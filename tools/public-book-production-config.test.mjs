import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createActionsExtractor} from '../deployment/cloudflare/workers/book-index-actions/worker.js'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const config=name=>JSON.parse(read('deployment/cloudflare/workers/'+name))
test('production bindings match documented live config and cannot overlap preview',()=>{
 const live=read('alpha-publish/wrangler.toml')
 for(const service of ['book-index-actions','book-index-jobs']){
  const prod=config(service+'/wrangler.production.jsonc'),preview=config(service+'/wrangler.jsonc')
  assert.notEqual(prod.name,preview.name);assert.equal(prod.workers_dev,false);assert.equal(prod.preview_urls,false);assert.equal(prod.routes,undefined)
  assert.equal(prod.d1_databases.length,1);const db=prod.d1_databases[0]
  assert.equal(db.binding,'VISITORS_DB');assert.ok(live.includes('database_id = "'+db.database_id+'"'));assert.ok(live.includes('database_name = "'+db.database_name+'"'))
  assert.notEqual(db.database_id,preview.d1_databases[0].database_id)
  assert.ok(Object.values(prod.vars).every(v=>v==='false'))
  assert.equal(prod.r2_buckets,undefined,'coordinator/queue need no private source bucket')
 }
 const jobs=config('book-index-jobs/wrangler.production.jsonc'),preview=config('book-index-jobs/wrangler.jsonc')
 assert.ok(jobs.queues.producers.every(p=>!preview.queues.producers.some(q=>p.queue===q.queue)))
 assert.equal(jobs.services[0].service,config('book-index-actions/wrangler.production.jsonc').name)
 assert.equal(jobs.queues.consumers[0].max_concurrency,1)
})
test('production workflow is manual-only, isolated gates/secret and fixed live origin',()=>{
 const workflow=read('.github/workflows/public-book-ingestion-production.yml')
 assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/pull_request|schedule:|push:/)
 assert.match(workflow,/permissions:\s+contents: read/);assert.doesNotMatch(workflow,/contents: write|id-token: write/)
 assert.match(workflow,/persist-credentials: false/);assert.match(workflow,/vars\.BOOK_INDEX_PRODUCTION_ACTIONS_ENABLED == 'true'/)
 assert.match(workflow,/vars\.PUBLIC_BOOK_PRODUCTION_INGESTION_ACCEPTED == 'true'/)
 assert.match(workflow,/secrets\.PUBLIC_BOOK_INDEX_PRODUCTION_RUNNER_TOKEN/)
 assert.doesNotMatch(workflow,/secrets\.PUBLIC_BOOK_INDEX_(?:PREVIEW_)?RUNNER_TOKEN|CLOUDFLARE|GITHUB_ACTIONS_TOKEN|PDF_TEXT_INDEXING/)
 assert.match(workflow,/PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN: https:\/\/khzanah\.com/)
 assert.doesNotMatch(workflow,/pages\.dev|\$\{\{ inputs\.[^}]+\}\}.*\n\s*run:/)
 for(const action of workflow.matchAll(/uses: ([^\s]+)/g))assert.match(action[1],/@[a-f0-9]{40}$/)
 assert.match(workflow,/PUBLIC_BOOK_INDEX_MAX_JOBS: '1'/);assert.match(workflow,/cancel-in-progress: false/)
 assert.match(workflow,/run: node tools\/public-book-index-runner\.mjs/)
 const preview=read('.github/workflows/public-book-ingestion-targeted.yml');assert.match(preview,/khizana-bok-acceptance-20260917\.pages\.dev/);assert.doesNotMatch(preview,/PRODUCTION_RUNNER_TOKEN/)
})
test('coordinator workflow selector admits two literal release entrypoints only',()=>{
 assert.throws(()=>createActionsExtractor({workflow:'attacker.yml'}),/dispatch_workflow_forbidden/)
 assert.throws(()=>createActionsExtractor({workflow:'../../actions'}),/dispatch_workflow_forbidden/)
 assert.equal(typeof createActionsExtractor({workflow:'public-book-ingestion-production.yml'}),'function')
 const production=read('deployment/cloudflare/workers/book-index-actions/production.js')
 assert.match(production,/workflow:'public-book-ingestion-production\.yml'/)
 assert.doesNotMatch(production,/env\.|request\./)
})
