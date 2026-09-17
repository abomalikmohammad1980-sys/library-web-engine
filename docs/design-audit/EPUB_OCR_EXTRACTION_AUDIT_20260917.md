# EPUB adapter and Arabic OCR readiness

Latest scope update: OCR and all PDF body indexing are deferred/cancelled for this release. The OCR inventory below is historical research only, not an outstanding request for user fixtures. PDFs now complete bookmarks-only indexing with source-bound scanned/text classification; scanned books show `ocr_pending` without failure or retry. See ADR0015. EPUB extraction remains in scope.

## Implemented locally

`tools/public-book-index-epub.mjs` and the narrow EPUB branch in the bounded extraction worker now support native EPUB2 NCX and EPUB3 navigation-document TOCs. The existing reader parser supplies body chapters; returned `pageIndex` is the actual EPUB chapter/page index used by the reader. Native TOC labels are preserved. No TOC produces an empty heading list, not invented headings. External/missing EPUB3 destinations fail closed. Archive limits: 10,000 entries and32MiB expanded, inside the existing isolated worker memory/time/output limits. EPUB3 uses the already-declared jsdom runtime without scripts or resource loading.

Four new tests pass: EPUB2/3 native navigation, absent native TOC, unsafe/missing targets, and real bounded worker output. Two genuine local EPUBs also passed the worker:

- الأحاديث الواردة في أطفال المشركين رواية ودراية: 98 body chapters,15 native TOC entries.
- الأحاديث الواردة في التكبير جمعًا وتخريجًا ودراسة:737 body chapters,323 native TOC entries.

This is extraction acceptance, not deployment or an end-to-end production ingestion claim.

The combined extraction regression command `node --test tools/public-book-index-executor.test.mjs tools/public-book-index-epub.test.mjs` passed all 20 tests. The separate `tools/ocr-evaluation.mjs` helper provides bounded Unicode-code-point CER and whitespace-token WER, NFC by default, with an explicitly named optional Arabic-diacritic removal policy. It rejects empty reference text and oversized edit grids. Its three synthetic unit tests check edit counts, normalization and limits; they are not real OCR accuracy evidence. Rates are retained even above 1, rather than converted to a misleading clipped accuracy percentage.

## OCR inventory — read-only, no activation

Directory: `D:/alkhizana/Files for work/كتب للاختبار`.

| Genuine local PDF | Pages | Text-layer sample pages1,5,20,40 | Reference text |
|---|---:|---|---|
| المستقبل لهذا الدين؛ نسخة مصورة — سيد قطب |109|0 characters on all4|Same-work DOCX `المستقبل لهذ الدين - سيد قطب.docx` exists; edition/page alignment not verified|
| خصائص التصور الإسلامي ومقوماته؛ نسخة مصورة — سيد قطب |205|0 characters on all4|Same-work DOCX `خصائص التصور الإسلامي ومقوماته - سيد قطب.docx` exists; edition/page alignment not verified|
| حراسة الفضيلة — بكر أبو زيد |136|0 characters on all4|No corresponding local named text found in file inventory|

Other scanned candidates with the same empty four-page sample: الإبطال111pages, الحدود والتعزيرات552, المدارس العالمية80, في ظلال القرآن5451. The PDF مسائل من فقه الجهاد is not a scanned benchmark: sample text lengths61/621/1926/1493.

These are text-layer probes, not proof that80% of every PDF is scanned. **No three validated ground-truth sets currently exist from this audit. No OCR accuracy percentage was measured or claimed.** Two matching works are only candidate references; a different edition or pagination must not be treated as ground truth. The third requires reviewed transcription or an edition-matched text.

## Feasible no-paid-service benchmark

- First CPU baseline: Tesseract LSTM with Arabic `ara` from `tessdata_best`. Official documentation confirms Arabic data and distinguishes best/fast LSTM models: https://tesseract-ocr.github.io/tessdoc/Data-Files.html . This is a benchmark candidate, not a claim it is the most accurate engine on these books.
- Comparator: PaddleOCR Arabic multilingual recognition model, documented at https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.en.md . Its generic benchmark numbers must not be presented as accuracy on our scanned books.
- Native Tesseract and Python paddleocr/pytesseract were not found in the currently selected runtime. No model installation, cloud OCR invocation or paid service was activated. Existing PDF.js/Poppler can support source inspection/rasterization.
- Evaluation requires reviewed matching page transcriptions from all3 books, sampled beyond covers; report raw Arabic character error rate and word error rate, plus explicitly documented normalized variants (diacritics etc.), reading-order errors, pages/minute and memory. Preserve PDF source and page identity; keep OCR provenance/version separate, never silently rewrite printed text.

## Remaining integration gates

The current PDF extraction/gateway contract explicitly permits bookmarks-only and rejects PDF body rows. The new attachment's text-PDF/OCR body requirement needs a deliberate versioned contract extension, corresponding search/reader provenance checks, and a bounded native OCR executor. This task does not switch that contract behind the existing flag. OCR should not run native processes inside a Pages Function; the trusted extraction executor must carry that work and return source/version-bound output to the lifecycle owner.
