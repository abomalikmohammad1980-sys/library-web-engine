# Live reader acceptance — isolated mobile, 17 September 2026

## Scope and evidence

Production batch33, `https://khzanah.com/books/151179`, fresh Chrome isolated context
`reader-slow-20260917`, viewport 390×844, Slow 4G emulation and 4× CPU slowdown.
No account, publication, book text or production database was modified.

An observation script sampled the loading surface and visible text during the
navigation. These are observations of this run, not universal performance bounds:

- First paint: 3,224 ms; first contentful paint: 5,004 ms.
- Reader loading status first observed at 5,015 ms.
- Slow-connection explanation first observed at 17,010 ms.
- Actual reader content (>500 visible characters) first sampled at 100,089 ms.
  CPU pressure delayed some samples, so this is an upper observation, not an
  exact render timestamp.
- Final title: «التفسير والبيان لأحكام القرآن — عبد العزيز الطريفي | الخِزانة».
- Final visible text length: 5,255 characters; loading surface removed.
- No horizontal page overflow at the mobile viewport.

The snapshot request took 12,553 ms (1,198,755 transferred bytes); author metadata
took 6,580 ms (322,195 bytes). The book asset had requests observed at 19,419 ms
and 7,934 ms; these are resource durations, not end-to-end opening time.

## Conclusion and remaining limits

The full production book eventually opens with progress feedback on a simulated
slow mobile connection. It does not remain an empty reader indefinitely in this
run. The initial pre-application interval and approximately 100-second observed
content arrival remain substantial: **this does not close opening performance
or prove sub-second loading**. Loading feedback must not be described as a speed
fix. No exact visual comparison with the user's original DOCX was possible.

This live check supersedes only the older statement that no full-book
slow-network production check had been performed. It does not close old-session,
installed-PWA, account, or BOK activation acceptance.

## Offline follow-up

The same isolated context had an active `/sw.js` controller and a cached
`/index.html`. Under the browser's Offline network emulation, a direct navigation
to `/books/151179?pageIndex=1` rendered 6,998 visible characters with the loading
surface removed. An earlier reload instead reached Chrome's network error page;
therefore offline reload stability is **not** closed by the successful navigation.
This was a browser tab, not a manually installed PWA.

The successful offline navigation exposed a separate metadata defect: the real
book text was visible but the title fell back to «الخِزانة» because the metadata
API was unavailable. The local fix shares the identity already approved by the
reader's visibility checks with route metadata. It is restricted to public book
paths, preserves private noindex, and lets richer server metadata take priority.
Seven model/route tests and app typecheck passed. The fix is not yet published.

## Offline reload root cause and local correction

Repeated offline reload reproduced Chrome's error page, although direct offline
navigation succeeded. Inspecting the isolated cache proved that `/index.html`
held a response with `url=https://khzanah.com/`, `redirected=true`, status 200.
Pages' index redirect was retained by Cache Storage. Such redirected responses
cannot satisfy reload navigation's redirect mode.

As a controlled browser experiment, only the cached shell in the disposable
`reader-slow-20260917` context was reconstructed as a fresh Response with identical
body/status/headers. The following offline reload succeeded at the original book
URL rather than Chrome's error page. No site/server or user account was changed.

`app/public/sw.js` now performs that reconstruction when returning a redirected
offline shell; live redirects are unchanged. Nineteen service-worker path,
recovery, update and contract tests passed, including a regression preserving
HTML and release headers while removing redirect history. The worker correction
is local pending the combined deployment; the browser experiment is causal
evidence, not a claim that the live worker was changed.
