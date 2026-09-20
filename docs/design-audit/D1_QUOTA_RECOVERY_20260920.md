# D1 quota incident and recovery candidate

On 2026-09-20, khzanah.com, the production Pages URL and both old/new previews returned HTTP 503 with the application's Arabic error message. Static assets returned 200. A filtered production Functions tail proved the cause: `D1_ERROR: Your account has exceeded D1's free tier daily row read limit.` No paid plan or permission expansion was made.

Batch62 reuses all 20,000 verified static files from batch61, including the accepted performance/search client and previous Quran/BOK-source improvements. Payload SHA-256: `805923ebef5336c47ef7b310cf6a46df770e8e09586d659f23ee04ce151549f3`. Two server files change: optional live-book samples are no longer queried on static landing pages, and this specific D1 quota error serves the static SPA shell with noindex/no-store, without canonical or JSON-LD. Other visibility/data errors still fail closed. The edge-cache layer propagates this specific error to the recovery path.

Twelve focused server/cache tests passed. All 20,000 static files and 16 font mappings were reverified. Functions compiled. Preview: https://46e0f47a.khezana.pages.dev. HTTP checks returned 200 for /, /books/21633, /settings and /search. In-app browser confirmed the homepage and full text reader for /books/151179. The heading query التوحيد displayed 4529 matches, 100 per page and 46 pages. It reports 23 books without complete index coverage; no complete-coverage claim is made.

This is an availability recovery, not replenishment of D1 quota. Account operations, current public uploads and database-dependent SSR remain affected until the quota recovers. The static homepage keeps normal SEO; quota fallback documents are temporarily noindex. More D1 read reduction is still needed, particularly dynamic listing and related-book queries. Full field/BOK acceptance is not activated or declared complete.

Production rollback target: batch55, deployment a987cf23-902b-45b4-9f28-8a3864c71230, frozen .artifacts/batch55/deploy/pages-dist. Rolling back will also restore the quota-induced 503, so prefer it only for a new release regression. Deployment and live verification receipt must be recorded before claiming publication.
