# General performance follow-up (not a completion claim)

Production baseline65 remains9d675d2d. User requests finishing general performance before publishing.

Implemented and tested: optional home sections hydrate near viewport; no speculative author metadata/listBooks prewarm; background indexing uses identity-scoped local-only listStoredBooks; empty Word resume avoids importing search modules; catalog retries back off3/15/60s, stop after3 automatic retries, never announce incomplete results; visibility failures explicitly reject the outer IndexedDB promise rather than hanging; static/read-only routes no longer await category/name requests, while editors and filters retain the gate.

Build plugin generates only each screen's static module dependency hints. Narrow-hash inline bootstrap preloads the actual initial route before stylesheet evaluation, never optional dynamic parsers. No external sources or script unsafe-inline. Standard deployment preparer retains this behavior when generated hints exist.

Measured Pages-host pair (same mobile emulation, separate lab runs):65 https://pagespeed.web.dev/analysis/https-9d675d2d-khezana-pages-dev/qvbdw0b3i4?form_factor=mobile score52/FCP5.2s/LCP6.2s/TBT510ms/CLS0;66 https://pagespeed.web.dev/analysis/https-61b557e6-khezana-pages-dev/l9pqj1cm9c?form_factor=mobile score65/FCP5.2s/LCP6.2s/TBT10ms/CLS0. CPU improvement, not completion of mobile rendering.

Exact full CSS inline experiment67 https://07024b23.khezana.pages.dev scored66/FCP5.0s/LCP5.8s/TBT20ms/CLS0.006: https://pagespeed.web.dev/analysis/https-07024b23-khezana-pages-dev/ty6tgkoxnc?form_factor=mobile. Not selected for production: larger HTML, marginal timing gain, Vite dynamic dependency still requested external CSS. Helper exists only for reproducing experiment; main pipeline does not inline CSS.

Batch68 local gate rejected incomplete SW aliases from staging before final build completion; never deployed. Added early stager font-alias guard.69 previewd7ece15e not final (preload script position revised and empty Word job early exit added afterward). Final current candidate70 uses completed pass13,20,000 files/16 fonts verified, fingerprint69124858637f1482e81242beed1add8b023c6afa7996da0639f8b1cc8bc759a1. Functions unchanged from65/63. No field/BOK activation. Candidate publication/measurement pending, see receipts rather than inferring success here.

Browser66 confirmed home renders and gateways hydrate on scroll (40 categories/3174 authors), preserving links.32 focused home/privacy/search tests and24 indexing/route tests passed across overlapping suites; four bootstrap/preload Node tests passed. App typecheck and pass13 production build completed. D1 quota recovery, mobile critical CSS/font delivery and broader route measurements remain open.
