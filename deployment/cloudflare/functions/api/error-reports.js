import { json, safeReport, sameOrigin, sha256 } from './_report-contract.js'

const DELIVERY_TIMEOUT_MS = 8_000

async function removePendingReport(kv, conversationId, linkToken) {
  await Promise.allSettled([kv.delete(`report:${conversationId}`), kv.delete(`link:${linkToken}`)])
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'cross_origin_forbidden' }, 403)
  if (!env.REPORTS_KV || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.TELEGRAM_BOT_USERNAME) return json({ error: 'report_service_unavailable' }, 503)
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) return json({ error: 'invalid_content_type' }, 415)
  let payload
  try { payload = safeReport(await request.json()) } catch { payload = null }
  if (!payload) return json({ error: 'invalid_report' }, 400)

  const conversationId = crypto.randomUUID()
  const bearerSecret = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`
  const linkToken = crypto.randomUUID().replaceAll('-', '')
  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString()
  const record = { conversationId, secretHash: await sha256(bearerSecret), payload, replies: [], createdAt: new Date().toISOString(), expiresAt }
  try {
    await env.REPORTS_KV.put(`report:${conversationId}`, JSON.stringify(record), { expirationTtl: 30 * 86400 })
    await env.REPORTS_KV.put(`link:${linkToken}`, conversationId, { expirationTtl: 7 * 86400 })
  } catch (error) {
    console.error('report_storage_failed', error instanceof Error ? error.message : String(error))
    await removePendingReport(env.REPORTS_KV, conversationId, linkToken)
    return json({ error: 'report_service_unavailable' }, 503)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('report_delivery_timeout'), DELIVERY_TIMEOUT_MS)
  let telegram, sent
  try {
    telegram = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `بلاغ قارئ ${conversationId}\n${payload.bookTitle}\n${payload.errorCode}\n${payload.route}`, disable_web_page_preview: true }),
    })
    sent = await telegram.json().catch(() => ({}))
  } catch (error) {
    console.error('report_delivery_failed', error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timeout)
  }
  if (!telegram?.ok || !sent?.ok || !sent?.result?.message_id) {
    await removePendingReport(env.REPORTS_KV, conversationId, linkToken)
    return json({ error: 'report_delivery_failed' }, 502)
  }
  record.telegramMessageId = String(sent.result.message_id)
  try {
    await env.REPORTS_KV.put(`report:${conversationId}`, JSON.stringify(record), { expirationTtl: 30 * 86400 })
    await env.REPORTS_KV.put(`telegram:${sent.result.message_id}`, conversationId, { expirationTtl: 30 * 86400 })
  } catch (error) {
    console.error('report_storage_finalize_failed', error instanceof Error ? error.message : String(error))
    await removePendingReport(env.REPORTS_KV, conversationId, linkToken)
    return json({ error: 'report_service_unavailable' }, 503)
  }

  return json({ conversationId, bearerSecret, pollUrl: `/api/report-conversations/${conversationId}`, telegramLinkToken: { token: linkToken, expiresAt, deepLink: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${linkToken}` } }, 201)
}

export const onRequest = () => json({ error: 'method_not_allowed' }, 405)
