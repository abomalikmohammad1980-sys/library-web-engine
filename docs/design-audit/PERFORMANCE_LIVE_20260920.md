# Live performance follow-up — 2026-09-20

Baseline is published batch62 (71d9122e), not the historical previews. Fresh PageSpeed report: https://pagespeed.web.dev/analysis/https-khzanah-com/iwz27oab3b?form_factor=mobile (captured 19:11 local).

Mobile: score65, FCP5.2s, LCP6.1s, TBT90ms, CLS0. Desktop: score86, FCP0.9s, LCP1.0s, TBT280ms, CLS0.01. These are individual lab runs, not proof of a universal user improvement. The mobile field window still fails CWV (28-day LCP5.4s); it cannot measure only today's deployment.

Current bottlenecks: global CSS76.7KiB and theme-init.js2.3KiB render blocking. Catalog snapshot1.17MiB and author metadata316KiB still load on home. Several database APIs take10–11s under exhausted quota. Neither overall mobile performance nor first-search latency is closed.

Batch63 candidate: embed exact normalized prepaint bootstrap bytes and authorize only their SHA256 in CSP; preserve theme, handoff timeout and no-JS behavior. No unsafe-inline script permission. Stamp SW with final HTML. Related-book suggestions request at most13 candidates rather than full upload COUNT/pagination; preserve fresh primary reads and withdrawal race fences. No D1 schema changes, privacy weakening or paid tier.21 focused tests pass. Candidate publication and post-change measurements must be recorded separately; this entry is not a deployment claim.

Preview63 https://5c957291.khezana.pages.dev:20,000 assets/16 fonts reverified; Functions compiled. Browser confirmed theme=original, no pending handoff, inline script executed, no CSP errors; reader151179 loaded with1350 headings. SQLite EXPLAIN confirms related queries no longer materialize/scan the current_uploads CTE; bounded result equivalence and withdrawal fence pass.

Paired Pages-host measurements: baseline62 https://pagespeed.web.dev/analysis/https-71d9122e-khezana-pages-dev/8uwo7aiouj?form_factor=mobile score41/FCP5.2/LCP6.2/TBT1180ms; candidate63 https://pagespeed.web.dev/analysis/https-5c957291-khezana-pages-dev/jbzy8h8ch1?form_factor=mobile score46/FCP5.2/LCP6.2/TBT750ms. The large variation versus the custom domain means no stable timing improvement is claimed. Removing a request and full-count queries is verified; remaining CSS/initial-catalog bottlenecks are not solved. Preview noindex is intentional.
