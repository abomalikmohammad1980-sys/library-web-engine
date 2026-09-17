# A1 bounded edge-cache helper (not yet integrated or deployed)

Baseline: production batch34, deployment `214d9565-f244-41d5-af51-e86309c463ce`.

## Exact middleware hook

Import `serveVersionedPublicHtml` from `./_seo-edge-cache.js`. After redirects and known-route checks, wrap only public HTML rendering:

```js
return serveVersionedPublicHtml({
  request,
  cache: caches.default,
  deploymentVersion: VERIFIED_DEPLOYMENT_CONTENT_SHA,
  loadSnapshot: () => loadFreshPublicSnapshot(),
  render: snapshot => renderHtmlFromSnapshot(snapshot),
  waitUntil: promise => context.waitUntil(promise),
})
```

`loadFreshPublicSnapshot()` must use authoritative uncached D1 reads. If D1 sessions are used, create a **new `first-primary` session for each invocation**, not a reused eventually-consistent session. Return null for withdrawn/missing/deleted or `{public:true, versionMaterial, ...renderData}`. Throw on unavailable visibility: helper returns 503/noindex/no-store, never old cached HTML. `render(null)` must use the existing true 404 behavior.

`versionMaterial` is the full current rendered public dependency projection, not `updatedAt` alone. Include the canonical public record (title, author, category, biography, death), the verified TOC pointer/hash, and every rendered related record/list item with its current visibility/revision. Include pagination in the URL (helper handles `page` and `tocPage`). A deployment SHA in the key prevents old app bundles/shell/meta templates surviving a release. Public shape only: never owner/session/source credentials. Snapshot JSON capped at 256Ki characters; larger projections bypass caching.

**Required before hooking:** batch34 `refreshPublicSeoRecord` accepts stale uploaded records if passed an existing record; always re-read `user_books` for uploaded records. It also lacks the later alias privacy veto. Check all raw / `central-submission:` / `account-book:` aliases, and deny if any is private/deleted. Numeric books require all canonical aliases too. Author/list pages currently reference static book lists: revalidate/filter the included books before considering their snapshot cacheable. Until those dependencies are verified, leave those pages uncached rather than assert freshness. These integration changes are not made by this helper task.

Cache hits are rechecked after `cache.match` to fence withdrawal during asynchronous lookup. Misses recheck after rendering before storage and return the new state if it changed. A request already authorized immediately before a concurrent delete can naturally be in flight; there is no claim to retract already delivered content.

## Header deviation approved by parent

The requested public `max-age=300, s-maxage=86400, stale-while-revalidate=604800` would allow browsers/proxies to serve withdrawn books without reaching the visibility check. Revocable HTML therefore returns **`Cache-Control: private, no-store`**. Only the internal version-keyed copy has **`public, max-age=86400`**. No CDN cache headers, validators, or Age escape to downstream clients. No SWR implementation/claim. Truly immutable public-only resources may use independent public caching, outside this helper.

Cache keys retain hostname, so preview noindex HTML and production cannot mix. Anonymous GET/HEAD only; cookies, authorization, Range, unknown/duplicate query parameters and request no-cache bypass. HEAD can read a GET hit but never stores a bodyless response. Set-Cookie, Vary, errors and redirects are never stored. Cache I/O failure falls back to fresh rendering, not stale content. No new paid resources.

## Evidence / remaining acceptance

`node --test tools/seo-edge-cache.test.mjs`: unit tests for canonical requests, version/TOC/deployment/host/pagination keys, mandatory warm-hit visibility, withdrawal/private/delete, revision invalidation, concurrent deletion, D1 outage, Cache outage, HEAD, Set-Cookie, preview noindex.

Not a performance result. Real HTMLRewriter/Cache API integration, authoritative visibility fixture and 30-URL cold/warm preview p95 measurements remain required. No cloud write or deployment in this task.

Official references read September 17, 2026:

- https://developers.cloudflare.com/workers/runtime-apis/cache/ — Cache API is local to the data center; supports response TTL but **not** stale-while-revalidate/stale-if-error; local delete is not a global purge.
- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ — use bindings and explicit awaited/waitUntil work, avoid cross-request mutable state.
