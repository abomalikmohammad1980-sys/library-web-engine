import { isManager, json, trustedAccount } from '../_account-contract.js'
import { providerQuotaSnapshot, PROVIDER_LIMITS } from '../_translation-router.js'

const PROVIDERS = Object.keys(PROVIDER_LIMITS)
const EMPTY_METRIC = { requests: 0, characters: 0, succeeded: 0, failed: 0 }

export async function readTranslationUsage(env, db, now = new Date()) {
  const month = now.toISOString().slice(0, 7)
  const quotas = PROVIDERS.map(provider => providerQuotaSnapshot(env, provider, now))
  const quotaRows = await db.prepare(`SELECT bucket,used FROM translation_provider_usage WHERE bucket IN (${quotas.map(() => '?').join(',')})`)
    .bind(...quotas.map(row => row.bucket)).all()
  const metricsRows = await db.prepare('SELECT provider,requests,characters,succeeded,failed,cache_hits,cache_characters_saved FROM translation_usage_metrics WHERE period=?1')
    .bind(month).all()
  const used = new Map((quotaRows.results || []).map(row => [row.bucket, Number(row.used) || 0]))
  const metrics = new Map((metricsRows.results || []).map(row => [row.provider, row]))
  const workersAi = ['workers-ai-m2m100', 'workers-ai-llm'].map(provider => {
    const metric = metrics.get(provider) || EMPTY_METRIC
    return {
      provider,
      period: month,
      unit: 'character',
      configured: !!env.AI,
      eligible: !!env.AI,
      limit: null,
      used: Number(metric.characters) || 0,
      remaining: null,
      requests: Number(metric.requests) || 0,
      characters: Number(metric.characters) || 0,
      succeeded: Number(metric.succeeded) || 0,
      failed: Number(metric.failed) || 0,
    }
  })
  return {
    period: month,
    routerEnabled: env.TRANSLATION_ROUTER_ENABLED === '1',
    providers: [...quotas.map(quota => {
      const metric = metrics.get(quota.provider) || EMPTY_METRIC
      const consumed = used.get(quota.bucket) || 0
      return {
        provider: quota.provider,
        period: quota.period,
        unit: quota.unit,
        configured: quota.configured,
        eligible: quota.eligible,
        limit: quota.limit,
        used: consumed,
        remaining: Math.max(0, quota.limit - consumed),
        requests: Number(metric.requests) || 0,
        characters: Number(metric.characters) || 0,
        succeeded: Number(metric.succeeded) || 0,
        failed: Number(metric.failed) || 0,
      }
    }), ...workersAi],
    cache: (() => {
      const row = metrics.get('cache') || {}
      return { hits: Number(row.cache_hits) || 0, charactersSaved: Number(row.cache_characters_saved) || 0 }
    })(),
    updatedAt: now.toISOString(),
  }
}

export async function onRequestGet(context) {
  const actor = await trustedAccount(context)
  if (!isManager(actor)) return json({ error: 'admin_required' }, 403)
  const db = context.env.VISITORS_DB
  if (!db?.prepare) return json({ error: 'translation_usage_unavailable' }, 503)
  try { return json(await readTranslationUsage(context.env, db)) }
  catch { return json({ error: 'translation_usage_unavailable' }, 503) }
}

export const onRequest = () => json({ error: 'method_not_allowed' }, 405, { allow: 'GET' })

