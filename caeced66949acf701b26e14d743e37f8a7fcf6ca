#!/usr/bin/env node
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { alignPages } from "./align.js";
import { applyApprovedBreaks } from "./apply.js";
import { extractDocxParagraphs, extractPdfPages, readFingerprinted } from "./extract.js";
import { readReport, writeReport } from "./report.js";
import { writeReviewHtml } from "./review.js";
import type { AlignmentReport, ApprovalFile } from "./types.js";

const args = process.argv.slice(2); const command = args.shift();
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined };
const required = (name: string) => { const value = option(name); if (!value) throw new Error(`missing ${name}`); return resolve(value) };

async function analyze() {
  const pdfPath = required("--pdf"), docxPath = required("--docx"), out = required("--out");
  await mkdir(out, { recursive: true }); const [pdf, docx] = await Promise.all([readFingerprinted(pdfPath), readFingerprinted(docxPath)]);
  const [pages, paragraphs] = await Promise.all([extractPdfPages(pdf.bytes), Promise.resolve(extractDocxParagraphs(docx.bytes))]);
  let wordPageMap: AlignmentReport["wordPageMap"]; let anchors: number[] | undefined;
  const mapPath = option("--word-page-map");
  if (mapPath) { const parsed = JSON.parse(await readFile(resolve(mapPath), "utf8")); const map = parsed.map ?? parsed.parts?.[0]?.map ?? parsed;
    anchors = Array.isArray(map.starts) ? map.starts.map((x: { paragraphIndex: number }) => x.paragraphIndex) : undefined;
    wordPageMap = { path: resolve(mapPath),
      ...(typeof parsed.fingerprint === "string" ? { fingerprint: parsed.fingerprint } : {}),
      ...(typeof map.totalPages === "number" ? { totalPages: map.totalPages } : {}) }; }
  const matches = alignPages(pages, paragraphs, anchors); const scored = matches.filter(m => m.confidence > 0);
  const report: AlignmentReport = { schemaVersion: 1, createdAt: new Date().toISOString(),
    inputs: { pdf: { path: pdfPath, sha256: pdf.sha256, bytes: pdf.bytes.length }, docx: { path: docxPath, sha256: docx.sha256, bytes: docx.bytes.length } },
    normalization: { arabicDiacritics: "ignored", tatweel: "ignored", alefVariants: "unified", whitespace: "collapsed" },
    metrics: { pdfPages: pages.length, docxParagraphs: paragraphs.length, auto: matches.filter(x => x.status === "auto").length,
      needsReview: matches.filter(x => x.status === "needs_review").length, emptyPdfPages: pages.filter(x => x.method === "empty-needs-ocr").length,
      measuredCoverage: pages.length ? scored.length / pages.length : 0, meanConfidence: scored.length ? scored.reduce((a,b)=>a+b.confidence,0)/scored.length : 0 },
    pages, matches, ...(wordPageMap ? { wordPageMap } : {}),
    limitations: ["درجات الثقة قياس تشابه نصي وليست ضمان تطابق بصري أو طباعي.", "OCR غير منفذ تلقائيًا في MVP؛ الصفحات المصورة تعلّم للمراجعة أو لمحرك Tesseract محلي اختياري.", "الهوامش الجانبية والمتون متعددة الأعمدة قد تختلط في ترتيب طبقة PDF النصية.", "لا يغيّر التطبيق الجداول أو الحواشي أو الصور؛ يضيف pageBreakBefore إلى فقرات معتمدة في نسخة جديدة فقط."] };
  const reportPath = resolve(out, "alignment-report.json"), reviewPath = resolve(out, "review.html");
  await writeReport(reportPath, report); await writeReviewHtml(reviewPath, report);
  console.log(JSON.stringify({ report: reportPath, review: reviewPath, metrics: report.metrics }, null, 2));
}
async function apply() {
  const docx = required("--docx"), reportPath = required("--report"), approvalsPath = required("--approvals"), output = required("--output");
  await mkdir(dirname(output), { recursive: true }); const report = await readReport(reportPath);
  const current = await readFingerprinted(docx); if (current.sha256 !== report.inputs.docx.sha256) throw new Error("docx_fingerprint_mismatch");
  const approvals = JSON.parse(await readFile(approvalsPath, "utf8")) as ApprovalFile;
  const changed = await applyApprovedBreaks(docx, output, report, approvals); console.log(JSON.stringify({ output, changed }, null, 2));
}
if (command === "analyze") await analyze(); else if (command === "apply") await apply();
else { console.error("Usage:\n  khizana-print-align analyze --pdf FILE --docx FILE --out DIR [--word-page-map MAP.json]\n  khizana-print-align apply --docx FILE --report REPORT --approvals APPROVALS --output COPY.docx"); process.exitCode = 2; }
