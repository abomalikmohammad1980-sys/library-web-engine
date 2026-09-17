import { json } from './_report-contract.js'

export async function onRequestPost({ request, env }) {
  if (!env.REPORTS_KV || !env.TELEGRAM_WEBHOOK_SECRET || request.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'not_found' }, 404)
  const update = await request.json().catch(() => ({}))
  const message = update.message
  const replyTo = message?.reply_to_message?.message_id
  const text = typeof message?.text === 'string' ? message.text.trim().slice(0, 4000) : ''
  if (!replyTo || !text) return json({ accepted: true })
  const conversationId = await env.REPORTS_KV.get(`telegram:${replyTo}`)
  if (!conversationId) return json({ accepted: true })
  const record = await env.REPORTS_KV.get(`report:${conversationId}`, 'json')
  if (!record) return json({ accepted: true })
  const messageId = String(message.message_id)
  if (record.replies.some(reply => reply.id === messageId)) return json({ accepted: true })
  record.replies = [...record.replies.slice(-49), { id: messageId, text, at: new Date((message.date || Date.now() / 1000) * 1000).toISOString() }]
  record.updatedAt = new Date().toISOString()
  await env.REPORTS_KV.put(`report:${conversationId}`, JSON.stringify(record), { expirationTtl: 30 * 86400 })
  return json({ accepted: true })
}
