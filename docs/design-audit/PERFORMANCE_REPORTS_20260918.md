# User-provided homepage performance reports

Latest user override: tackle performance now while the source-range transfer continues. Publish accepted fixes after transfer and independent verification. Do not claim this report is a full search benchmark or publish unaccepted BOK activation.

Sources inspected through the in-app browser:
- https://pagespeed.web.dev/analysis/https-khzanah-com/j7hlv5peqw?form_factor=desktop
- https://public.catchpoint.com/UI/Entry/WPTITP/ARPZ-D-E-B2ADpcOjfFRfIXwAA-N

PageSpeed desktop: performance62, FCP1.1s, LCP1.3s, TBT3140ms, CLS0.01. Main-thread18.4s includes Other15058ms, script evaluation2069ms, layout513ms. Twenty long tasks. Estimated savings: render blocking820ms, cache704KiB, images322KiB, unused JS249KiB, unused CSS55KiB. Transfer3381KiB. These are laboratory figures; field data unavailable.

WebPageTest desktop Columbus, Chrome148, WiFi240/120Mbps: TTFB1.12s, FCP/LCP2.857s, CLS0.005, TBT0.293s, total10.152s,138requests, reported page weight6MB. Different environment/measurement accounting; do not directly equate its figures with PSI or add estimated savings.

Confirmed code lead: book_cover.ts does16 write/geometry-read iterations per text node and repeats fitting on resize, mutation and font events. First local candidate coalesces notifications using route-scoped animation scheduling; fitting algorithm and text remain unchanged. Eight targeted tests pass; before/after production performance and visual acceptance remain pending. This does not resolve all forced layouts or explain the large Other category.

Next: profile long tasks/Other, batch cover layout reads/writes with title-fit regressions, inspect heavy startup imports (including PDF code), render-blocking CSS, responsive logo assets, and versioned cache policy. Do not cache mutable manifests or authenticated APIs as immutable. Preserve SEO content, fonts, accessibility and offline behavior. Require comparable cold/warm measurements and functional checks after each change.

Second local candidate: removed home from automatic reader prewarm eligibility; the actual reader route still loads normally. Changed the reader's formatted-PDF generator from a static import to an awaited action-local import, matching the existing library download pattern. Export errors retain the existing user-facing handling. Twelve targeted tests and app TypeScript passed before adding a source-boundary regression. Production build/visual export acceptance and before/after timings remain required. These are local candidates, not a deployment receipt or proof of all report issues resolved.

Follow-up validation: all13 focused tests passed, app TypeScript passed, and production Vite build completed in62s into `.artifacts/performance-20260918/client`. Build warnings about runtime-provided fonts/data remain; this client directory alone is not a deployable frozen release. UI translation dictionaries already have a non-Arabic lazy loader: their large emitted chunk is not by itself proof they load on the Arabic homepage. Do not remove translation features based on bundle size alone.

## Second implementation pass (not live)

- Cover fitting now batches all writes before reads across the route's pending covers, preserving16 binary-search iterations and exact title text. The old route's queue is disposed with its observers. Tests prove equal fit bounds and16 read phases rather than per-cover interleaving.
- Optional recommendations wait until their section approaches the viewport. Identity checks and complete discovery remain; no catalog entries are removed. Cancellation/fallback tests pass.
- Daily quote selection stops after18 valid passages per book, preserving the old selection order without normalizing later paragraphs. Equivalence and early-stop tests pass.
- Browser inspection on fresh local origin127.0.0.1:5182 confirmed the home heading, loaded logos, no overflow in sampled cover titles, and navigation to the library. This is not a production timing benchmark.
- Logo selection uses picture for print/forced colors; small ordinary marks use an inlined128px lossless WebP derivative (18386bytes). The cover mask derivative is13752bytes. Large welcome/reader logos and print keep the official masters. Derivatives generated reproducibly; original PNGs unchanged. No extra deploy objects for inline thumbnails.
- Versioned-font build plugin emits identical reviewed font bytes under content-hashed assets URLs, updates CSS before hashing, redirects old addresses and injects Service Worker offline aliases. Original font copies are omitted to keep Pages'20000-file budget unchanged. Four Node tests including offline legacy-font lookup and19 SW regression tests pass. Full pass3 build and candidate verification must complete before acceptance; do not publish without font-map integrity and offline/browser checks.

Targeted pass:17 home/cover tests,15 brand/lifecycle tests, app TypeScript passed. Builds pass2 and pass3 completed. Batch56 was frozen and verified (19999 local files,142 remote assets plus SEO/HTTP checks), then published as preview https://17b833c4.khezana.pages.dev. Production remains batch55.

## Measured preview and cache follow-up

PageSpeed desktop preview report https://pagespeed.web.dev/analysis/https-17b833c4-khezana-pages-dev/duf375nuqn?form_factor=desktop: performance67, FCP1.0s, LCP1.2s, TBT830ms, CLS0.009, speed index1.7s. Compared with the user's original report, blocking time fell from3140ms to830ms in these separate laboratory runs; this is not a controlled field guarantee. Main-thread Other remains large (18510ms) and20 long tasks remain. Unused JS estimate86KiB. Preview SEO66 is affected by intentional noindex; never remove preview noindex to inflate this score.

Actual HTTP inspection found conflicting cache directives concatenated by Pages: global no-cache plus immutable for fonts. Frozen batch58 now scopes no-cache to mutable files/directories instead of /*. Its font response confirms only public,max-age=31536000,immutable. Search bootstrap is classic defer before the non-async module, preserving execution order while avoiding parser blocking. Unit tests cover both policies.

Batch58 preview https://3e46d61e.khezana.pages.dev, fingerprint a4e5cedf6ef3c1caa45c00eafbb5c9bd8c42e40de5b1ee49840fc6d8b00c9717:19999 local files verified;142 remote assets verified; SEO/HTTP checks passed (including canonical redirects,404 and11776 static sitemap URLs). In-app browser confirmed the home UI renders. Receipts: .artifacts/batch58/preview-assets.json and preview-http.json. No live publication yet.

Further local change: background indexing retains immediate event listeners but imports outline/body indexing engines only after finding an eligible local revision. PDF never loads the body-index engine. Identity/abort checks surround asynchronous imports. Six focused tests pass, including retries and account isolation. This change is not in batch58; it requires a new build/frozen candidate before publication.

Source verification completed: session67019 exited0,8595 objects,638884725bytes, complete:true at2026-09-18T19:57:12.924Z. No activation implied.

Batch59 https://2ccaffcf.khezana.pages.dev includes deferred background engines;20000 local files and143 remote assets plus SEO/HTTP checks passed. Its PageSpeed report https://pagespeed.web.dev/analysis/https-2ccaffcf-khezana-pages-dev/cmh7y5cfd2 has mobile36 (FCP5.2s,LCP6.4s,TBT2240ms,CLS0), desktop62 (FCP1.0s,LCP1.2s,TBT11630ms,CLS0.007). This variability invalidates any claim that the earlier830ms result closed performance. Desktop main thread27.9s and continuous unattributed origin tasks require further work.

Read-only heading transport diagnostic against59 initially timed out after dictionary reads consumed79s. HTTP confirms static pack Range requests return200 with complete7–10MB files, not requested small slices. The three sampled partitions belong to three different packs: a same-pack cache alone cannot fix their first query. Added bounded32MiB per-client complete-pack cache with SHA-256 filename verification for repeated partitions/queries;16 transport/cache tests and TypeScript pass. A later local-client/live-assets diagnostic returns the expected4 hits in74621ms, still slow and not browser acceptance. Receipts heading-transport.json and heading-cache-check.json. Do not claim below-second search.

Further paint lead: .app-main::before animated background-position indefinitely across the page with a gradient mask. Removed only the decorative motion, keeping the ornament/colors/mask, to avoid continuous full-page paints. Ten theme/paint tests pass. Build pass5(session71657) includes this and the pack cache; next immutable candidate60 must be measured before publication.

Remaining: comparable measurements of the paint change, functional acceptance including mobile/print/offline and search, then live publication of the accepted frozen candidate. All-report completion is not claimed.

## Batch60 paint measurement and next transport candidate

Batch60 https://b4b405c9.khezana.pages.dev passed20000 local files,143 remote assets and SEO/HTTP checks. In-app DOM confirmed home heading, no horizontal overflow and computed ornament animation:none. Quran checks on59 (same relevant client code) confirmed all3 mode buttons at identical y and the requested Mathoor label.

PageSpeed report https://pagespeed.web.dev/analysis/https-b4b405c9-khezana-pages-dev/grb8n5wzvd: desktop65,FCP1.0s,LCP1.2s,TBT1160ms,main-thread4.0s,9long tasks; mobile49,FCP5.1s,LCP6.0s,TBT640ms,main-thread7.8s,16long tasks. The large reduction in main-thread duration from59 (desktop27.9s/mobile25.1s) supports the full-page repaint diagnosis; initial mobile rendering remains slow.32 focused tests pass; updated the old hero test to require preserved static ornament rather than the removed animation.

New61 candidate under preparation: same-origin read-only dictionary-partition endpoint, pinned to the existing descriptor. It streams from env.ASSETS, selects at most1MiB from the approved <=25MiB pack, verifies the selected gzip SHA and sends only that shard. No catalog changes, uploads, credentials or new services. Four server tests cover ignored Range, valid206, corrupt/misplaced/truncated input, cancellation and path/budget rejection. Eight client cache/transport tests and TypeScript pass. This endpoint is not live or accepted until preview transport/browser checks complete. Build pass6(session19753) contains its client call; frozen61 must include the three explicit server/descriptor additions.
