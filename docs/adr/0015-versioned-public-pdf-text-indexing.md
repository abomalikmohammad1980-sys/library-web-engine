# ADR 0015: PDF bookmarks-only indexing and verified scan classification

Status: latest explicit user decision supersedes the attachment's native-PDF/OCR indexing requirement. OCR is deferred completely.

## Decision

Every PDF uses `pdf-bookmarks-only`: body rows are always empty, whether it contains a text layer or scanned images. Only actual PDF outline bookmarks are searchable headings; no TOC is inferred. The obsolete `PDF_TEXT_INDEXING` flag cannot enable body extraction, activation, verified reads, or public body results. The uncommitted native-v2 adapter and proof migration were removed; gateway rejects v2 extraction contracts and consumers reject old v2 artifact keys.

The bounded executor examines all pages' text layers solely for classification, retaining no body text in its output. Fewer than 20 non-whitespace Unicode characters on at least 80% of pages classifies the PDF as scanned. The source-bound `pdf-source-classification/1` receipt includes source SHA256, parser version, page count and low-text-page count. These are classification facts, not OCR accuracy or OCR output.

Migration0039 adds generation/source-bound classifier facts. After ordinary immutable artifact and search verification, scanned books complete underlying jobs as `ready` with bookmark coverage; their administrator projection becomes `ocr_pending`, meaning “مصوّر — بلا نص قابل للبحث”. This is not a failed ingestion and does not schedule OCR retries. Real indexed_at and public metadata/bookmark SEO remain available. OCR remains false. Source or generation changes cannot reuse stale classifier status.

## Safety and verification

Private/stale books remain fenced throughout source reads, verification, activation and consumers. Public PDF body results are explicitly excluded even if an obsolete flag is present. Native-v2 outputs are rejected even under that flag. Real PDF.js-generated text/scanned fixtures exercise complete worker-to-gateway-to-search/reader lifecycle, bookmark search, empty body search, admin status and stale-generation reset.

No remote migrations, flags, paid OCR, models, or deployments were activated. There is no requirement to provide OCR accuracy fixtures for this deferred scope.
