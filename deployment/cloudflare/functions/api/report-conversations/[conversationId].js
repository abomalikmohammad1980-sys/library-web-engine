import { bearer, json, sameOrigin, sha256 } from '../_report-contract.js'

export async function onRequestGet({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: 'cross_origin_forbidden' }, 403)
  if (!env.REPORTS_KV) return json({ error: 'report_service_unavailable' }, 503)
  const record = await env.REPORTS_KV.get(`report:${params.conversationId}`, 'json')
  if (!record || !bearer(request) || await sha256(bearer(request)) !== record.secretHash) return json({ error: 'conversation_not_found' }, 404)
  return json({ conversationId: record.conversationId, replies: record.replies, updatedAt: record.updatedAt || record.createdAt })
}
