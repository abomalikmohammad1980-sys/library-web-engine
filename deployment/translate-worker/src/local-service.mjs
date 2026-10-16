import { LocalQueueStore } from './local-queue.mjs'
import { HY_MT_MODEL, HY_MT_PROVIDER, validateLocalTranslation } from './local-policy.mjs'

// All keys, source text and language come from the queued payload, never a result submission.
export class LocalTranslationService {
  constructor(sql, adapters) {
    this.store = new LocalQueueStore(sql)
    this.adapters = adapters
    this.commits = new Map()
    this.fallbacks = new Map()
  }
  async enqueue(payload) {
    const plan = await this.adapters.plan(payload)
    if (plan.translation) {
      await this.adapters.completed?.(payload, plan.translation)
      return { cached: true, translation: plan.translation }
    }
    const row = this.store.enqueue(payload)
    return { id: row.id, state: row.state }
  }
  async claim() {
    const row = this.store.claim()
    if (!row) return null
    const plan = await this.adapters.plan(row)
    if (plan.translation) {
      await this.adapters.completed?.(row, plan.translation)
      this.store.finish(row.id, row.token)
      return { skipped: true, id: row.id }
    }
    return { id:row.id, token:row.token, target:row.target, purpose:row.purpose,
      sourceType:row.sourceType, mode:row.mode, leaseUntil:row.lease_until,
      units:plan.units.filter(unit=>!unit.translation).map(unit=>({index:unit.index,text:unit.text})) }
  }
  renew(id, token) { return this.store.renew(id, token) }
  async prepare(id, token, index) {
    const row = this.store.requireLease(id, token)
    const plan = await this.adapters.plan(row)
    if (plan.translation) return { needed:false }
    const unit = plan.units.find(unit=>unit.index===index)
    if (!unit) throw Error('invalid_unit')
    return unit.translation ? { needed:false } : { needed:true, unit:{index:unit.index,text:unit.text} }
  }
  async result(body) {
    const previous = this.store.get(body.id)
    if (previous?.state==='completed' && previous.token===body.token) return {accepted:true,reused:true}
    // Join replayed submissions in this DO; R2's conditional write survives DO restarts.
    const key = `${body.id}:${body.index}`
    if (this.commits.has(key)) {
      this.store.requireLease(body.id, body.token)
      return this.commits.get(key)
    }
    const task = this.saveResult(body)
    this.commits.set(key, task)
    try { return await task } finally { this.commits.delete(key) }
  }
  async saveResult(body) {
    const row = this.store.requireLease(body.id, body.token)
    const plan = await this.adapters.plan(row)
    if (plan.translation) return { accepted:true, reused:true }
    const unit = plan.units.find(unit=>unit.index===body.index)
    if (!unit) throw Error('invalid_unit')
    if (unit.translation) return { accepted:true, reused:true }
    const error = validateLocalTranslation(unit.text, body.translation, row.target, body.finishReason)
    if (error) {
      this.store.fallback(row.id,row.token,error)
      await this.adapters.telemetry(row,{error})
      return { accepted:false, fallback:true, error }
    }
    this.store.renew(row.id,row.token)
    const result = await this.adapters.save(unit,body.translation,row)
    if (result.created) await this.adapters.telemetry(row,{
      model:HY_MT_MODEL, provider:HY_MT_PROVIDER, latencyMs:Math.max(0,Math.min(Number(body.latencyMs)||0,600000)),
      sourceChars:[...unit.text].length,
    })
    return { accepted:true, reused:!result.created }
  }
  async complete(id, token) {
    const previous = this.store.get(id)
    if (previous?.state === 'completed' && previous.token === token) return { completed:true,duplicate:true }
    const row = this.store.requireLease(id,token)
    const plan = await this.adapters.plan(row)
    if (!plan.translation) throw Error('incomplete_job')
    await this.adapters.completed?.(row, plan.translation)
    return this.store.finish(id,token)
  }
  async fail(id, token, reason) {
    const previous = this.store.get(id)
    if (previous?.state==='completed' && previous.token===token) return {completed:true,duplicate:true}
    this.store.requireLease(id,token)
    if (this.fallbacks.has(id)) return this.fallbacks.get(id)
    const task=this.runFallback(id,token,reason)
    this.fallbacks.set(id,task)
    try { return await task } finally { this.fallbacks.delete(id) }
  }
  async runFallback(id, token, reason) {
    const row = this.store.requireLease(id,token)
    if (row.mode !== 'fallback') {
      this.store.fallback(id,token,reason)
      await this.adapters.telemetry(row,{error:reason})
    }
    // Persist fallback intent BEFORE invoking the existing provider pipeline.
    try {
      await this.adapters.fallback(row)
      return await this.complete(id,token)
    } catch {
      this.store.retryLater(id,token)
      return { completed:false, state:this.store.get(id).state }
    }
  }
}
