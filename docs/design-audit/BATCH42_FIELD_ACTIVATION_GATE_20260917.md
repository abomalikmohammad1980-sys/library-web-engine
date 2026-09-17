# Field activation gate — not production-ready

Production remains batch41 (`151af741-5955-4c77-aafb-43189c8d51b0`).
Preview `https://7fa54765.khezana.pages.dev` is deliberately NOT promoted.

## Completed

- Uploaded and readback-verified all 8,595 immutable boundary-overlay objects.
- Prepared batch42 from the frozen batch41 payload and Functions closure.
- Compiled Functions and passed preview SEO/HTTP checks (including 404, redirects,
  sitemap counts and noindex on previews).
- In-app browser displayed the body-only/footnote-only selection controls.
- Full fresh remote verification started. One attempt failed on transient S3
  HTTP500. Added a two-retry ceiling and restarted; completion not yet established.

## Real cloud blocker found before activation

The real consumer passed the first result for public book21633, then rejected
the next result with `search_field_source_token_count`. Its proved index has
204 tokens, including eight own-heading tokens; the legacy display snippet has
196. Display snippets can also be cleaned or clipped to6,000 characters. They
are not valid raw positional sources. Do not relax token checks or infer field
ownership by subtracting an observed length difference.

## Repair in progress

- `field-source-json-ranges.mjs` locates exact UTF8 quoted-string byte ranges in
  checksum-bound original JSON, preserving headings, body, foot and escapes.
- `build-field-source-ranges.mjs` builds gzip metadata only; the existing books
  are reused. Originals are read-only and their SHA must match the overlay.
- Confirmed production source gateway returns206 for a128-byte range of21633.
- `search_field_raw_rows.ts` checks manifest/index pins, range responses and each
  string SHA, then reconstructs the original positional text. It never requests
  an entire source book. This path is explicit opt-in, not active in production.
- Tested the original21633 text and exact footnote ownership; the old display
  snippet fails the regression as expected.14 initial field tests, then34 focused
  field/integration tests passed;2 opt-in tests skipped. App typecheck passed.
- All8,594 source-range indexes are generated:7,626,594 documents and
  638,884,725 total metadata bytes. Descriptor SHA:
  `22f94a61c287f256af8ddca967140b831c73f56bd9e00d5d062cf7dc26121bb3`.
- Metadata upload has begun, but is NOT complete. Repeated S3 readback timeouts
  did not imply missing data: public book71 metadata returned200,3,390,601bytes
  and its exact SHA in20,786ms. Upload now validates through the public reader
  route; conditional immutable writes and integrity checks remain unchanged.
- Batch43 repaired client built successfully; TypeScript passed again on18Sept.
  Candidate fingerprint:
  `15779caae0e075ce03c584148ca50b3182addb396fc55af7526c8ea3f76479ce`.
  Preview deployed at `https://4d9cbc59.khezana.pages.dev`.
  No production activation is claimed.
- Batch43 SEO/HTTP acceptance passed (canonical, unique titles,404,301,
  noindex preview and11,776 core sitemap URLs). In-app browser confirmed the
  three text scopes render and “الحاشية فقط” can be selected. This is control
  acceptance, NOT successful full cloud search acceptance.
- A second transport issue was proven: canonical book98 metadata returned a
  cached404 (`cf-cache-status:HIT`,age75), while a fresh query returned200 and
  the exact25,317byte SHA. Upload probes now use distinct query keys so they
  cannot cache absence at the canonical URL. Fresh acceptance remains canonical.
- Public transport and range/uploader regression tests:15 passed. Six client
  release/raw-source regression tests passed again. Public fresh
  verification resumes independently from upload receipts and is incomplete.
- Large book333 metadata (3,718,053bytes) exceeded the whole-response timeout.
  Bounded512KiB reads returned strict206 ranges and reconstructed its exact
  SHA in30,531ms. New regression rejects wrong ranges and200 fallback. Upload
  resumed using this transport; no integrity or completion gate was relaxed.

An abandoned local row-copy prototype was stopped after about1,000 books. Its
ignored temporary artifacts are preserved under `.artifacts/field-source-rows-*`;
they are not production assets and must not be uploaded. The final design uses
`.artifacts/field-source-ranges-*`, reusing existing source bytes instead.

## Remaining gates

Finish publishing immutable range metadata;
finish fresh boundary verification; run cloud consumer and in-app acceptance;
publish the identical accepted payload and verify live. BOK operational gates
remain separate and disabled; no BOK completion is claimed by this field work.
