import {boundedBytes} from './_seo-toc.js'
import {readSeoIdentity} from './_seo-identity.js'
import {readSeoListing, visibleSeoListingRows} from './_seo-listings.js'
import {cachedSeoImmutable} from './_seo-immutable-cache.js'
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
/** Explicit release pin: an unavailable/corrupt release must not silently use
 * an older catalog. Omitted pin keeps the currently deployed legacy path. */
export async function loadSeoDataRelease(env, origin, {cache=globalThis.caches?.default}={}) {
  if (!env.SEO_DATA_RELEASE_SHA256) return null
  const publicBucket = env.PUBLIC_LIBRARY_R2 ?? env.LIBRARY_R2
  if (!/^[a-f0-9]{64}$/.test(env.SEO_DATA_RELEASE_SHA256) || !publicBucket) throw Error('seo_release_binding')
  const response = await env.ASSETS.fetch(new URL('/data/seo/release.json', origin))
  if (!response.ok) throw Error('seo_release_missing')
  const bytes = await boundedBytes(response.body, 200000)
  if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== env.SEO_DATA_RELEASE_SHA256) throw Error('seo_release_checksum')
  const descriptor = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes))
  if (descriptor.contract !== 'seo-data-release/1' || !/^[a-f0-9]{64}$/.test(descriptor.listings?.releaseId)) throw Error('seo_release_contract')
  // Closure lifetime is one load/request. Only immutable raw buckets are shared;
  // every listing invocation still opens a fresh first-primary visibility read.
  const rawMemo = new Map()
  const immutable=(key,load)=>cachedSeoImmutable({cache,release:env.SEO_DATA_RELEASE_SHA256,key,load,origin:new URL(origin).origin})
  return {
    descriptor,
    identity: (kind, id) => immutable(`identity:${kind}:${id}`,()=>readSeoIdentity(publicBucket, descriptor.identities, kind, id)),
    async listing(list, page) {
      const result = await readSeoListing(null, origin, list, page, {bucket:publicBucket,releaseId:descriptor.listings.releaseId,rawMemo,immutableLoad:(name,load)=>immutable(`listing:${name}`,load)})
      if (!result) return null
      const db = typeof env.VISITORS_DB?.withSession === 'function' ? env.VISITORS_DB.withSession('first-primary') : env.VISITORS_DB
      return {...result, rows:await visibleSeoListingRows(db, result.rows,{list})}
    },
  }
}
export function seoListingPage(url) {
  const values = url.searchParams.getAll('page')
  if (!values.length) return 1
  if (values.length !== 1 || !/^\d+$/.test(values[0])) return null
  const page = Number(values[0])
  return Number.isSafeInteger(page) && page >= 1 && page <= 1000000 ? page : null
}
