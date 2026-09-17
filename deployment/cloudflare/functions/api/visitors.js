import {trustedAccount,isSuperAdmin} from './_account-contract.js'
const VISITOR_COOKIE = 'khizana_visitor_v1'
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const responseHeaders = {
  'cache-control': 'private, no-store, max-age=0',
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...responseHeaders, ...extraHeaders },
  })
}

export function visitorIdFromCookie(header) {
  if (!header) return null
  for (const segment of header.split(';')) {
    const separator = segment.indexOf('=')
    if (separator < 0) continue
    const name = segment.slice(0, separator).trim()
    if (name !== VISITOR_COOKIE) continue
    const value = segment.slice(separator + 1).trim()
    return VISITOR_ID_PATTERN.test(value) ? value.toLowerCase() : null
  }
  return null
}

export function visitorCookie(visitorId) {
  return `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`
}

function trustedSameOriginWrite(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

function totalFromRow(row) {
  const value = typeof row?.total === 'number' ? row.total : Number.NaN
  return Number.isSafeInteger(value) && value >= 500 ? value : null
}

async function currentTotal(database) {
  const row = await database.prepare(
    'SELECT (SELECT baseline_count FROM visitor_counter_meta WHERE id = 1) + COUNT(*) AS total FROM unique_visitors',
  ).first()
  return totalFromRow(row)
}

export async function onRequestGet(context) {
  if(!isSuperAdmin(await trustedAccount(context)))return json({error:'admin_required'},403)
  const database = context.env?.VISITORS_DB
  if (!database) return json({ error: 'visitor_counter_unavailable' }, 503)
  try {
    const period=new URL(context.request.url).searchParams.get('period')??'30'
    if(!['7','30','90','all'].includes(period))return json({error:'invalid_period'},400)
    const since=period==='all'?'0001-01-01':new Date(Date.now()-Number(period)*86400000).toISOString().slice(0,19).replace('T',' ')
    const results=await database.batch([
      database.prepare('SELECT COUNT(*) AS total FROM unique_visitors'),
      database.prepare('SELECT COALESCE(country,\'XX\') AS country,COUNT(*) AS count FROM unique_visitors WHERE first_seen>=?1 AND first_seen >= (SELECT MIN(country_seen_at) FROM unique_visitors WHERE country_seen_at IS NOT NULL) GROUP BY COALESCE(country,\'XX\') ORDER BY count DESC,country').bind(since),
      database.prepare('SELECT baseline_count FROM visitor_counter_meta WHERE id=1'),
      database.prepare("SELECT COUNT(*) AS participants,AVG(CAST(strftime('%Y','now') AS INTEGER)-birth_year) AS average FROM account_demographics WHERE consent=1 AND birth_year BETWEEN CAST(strftime('%Y','now') AS INTEGER)-120 AND CAST(strftime('%Y','now') AS INTEGER)"),
      database.prepare('SELECT COUNT(*) AS total FROM accounts'),
      database.prepare("SELECT CASE WHEN age<18 THEN 'under18' WHEN age<25 THEN '18-24' WHEN age<35 THEN '25-34' WHEN age<45 THEN '35-44' WHEN age<55 THEN '45-54' ELSE '55plus' END AS band,COUNT(*) AS count FROM (SELECT CAST(strftime('%Y','now') AS INTEGER)-birth_year AS age FROM account_demographics WHERE consent=1) WHERE age BETWEEN 0 AND 120 GROUP BY band")
    ])
    const countries=results[1].results??[],sample=countries.reduce((n,row)=>n+Number(row.count),0)
    return json({total:Number(results[0].results?.[0]?.total??0),legacyBaseline:Number(results[2].results?.[0]?.baseline_count??0),sample,countries,period,updatedAt:new Date().toISOString(),age:{participants:Number(results[3].results?.[0]?.participants??0),accounts:Number(results[4].results?.[0]?.total??0),average:Number(results[3].results?.[0]?.participants??0)>=5?Number(results[3].results?.[0]?.average):null,bands:(results[5].results??[]).filter(r=>Number(r.count)>=5)}})
  } catch (error) {
    console.error(JSON.stringify({ event: 'visitor_counter_read_failed', message: error instanceof Error ? error.message : String(error) }))
    return json({ error: 'visitor_counter_unavailable' }, 503)
  }
}

export async function onRequestPost(context) {
  if (!trustedSameOriginWrite(context.request)) return json({ error: 'cross_site_request_rejected' }, 403)
  const database = context.env?.VISITORS_DB
  if (!database) return json({ error: 'visitor_counter_unavailable' }, 503)

  const existingId = visitorIdFromCookie(context.request.headers.get('cookie'))
  const visitorId = existingId ?? crypto.randomUUID()
  try {
    await database.batch([
      database.prepare('INSERT OR IGNORE INTO unique_visitors (visitor_id) VALUES (?1)').bind(visitorId),
      database.prepare('UPDATE unique_visitors SET country=?2,country_seen_at=COALESCE(country_seen_at,CURRENT_TIMESTAMP) WHERE visitor_id=?1 AND country IS NULL').bind(visitorId,visitorCountry(context.request.cf?.country)), 
    ])
    const headers = { vary: 'Cookie' }
    if (!existingId) headers['set-cookie'] = visitorCookie(visitorId)
    return json({ ok:true }, 200, headers)
  } catch (error) {
    console.error(JSON.stringify({ event: 'visitor_counter_write_failed', message: error instanceof Error ? error.message : String(error) }))
    return json({ error: 'visitor_counter_unavailable' }, 503)
  }
}

export function visitorCountry(value){return typeof value==='string'&&/^[A-Z]{2}$/.test(value)&&value!=='XX'?value:null}
export const onRequest = () => json({ error: 'method_not_allowed' }, 405, { allow: 'GET, POST' })
