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
