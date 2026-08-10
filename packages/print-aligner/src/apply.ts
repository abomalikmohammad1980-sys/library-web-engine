import { readFile, writeFile } from "node:fs/promises";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { AlignmentReport, ApprovalFile } from "./types.js";
import { reportHash } from "./report.js";

export async function applyApprovedBreaks(docxPath: string, outputPath: string, report: AlignmentReport, approvals: ApprovalFile): Promise<number> {
  if (approvals.reportSha256 !== reportHash(report)) throw new Error("approvals_report_fingerprint_mismatch");
  const unresolved = report.matches.filter(m => m.status === "needs_review" && !approvals.decisions.some(d => d.pdfPage === m.pdfPage));
  if (unresolved.length) throw new Error(`unresolved_pages:${unresolved.map(x => x.pdfPage).join(",")}`);
  const accepted = new Map<number, number>();
  for (const m of report.matches) if (m.status === "auto" && m.pdfPage > 1 && m.paragraphIndex != null) accepted.set(m.pdfPage, m.paragraphIndex);
  for (const d of approvals.decisions) { if (d.action === "reject") accepted.delete(d.pdfPage); else if (d.paragraphIndex != null && d.pdfPage > 1) accepted.set(d.pdfPage, d.paragraphIndex) }
  const source = new Uint8Array(await readFile(docxPath)); const zip = unzipSync(source); const key = "word/document.xml";
  let xml = strFromU8(zip[key]!); let paragraph = -1; let changed = 0;
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, block => {
    paragraph++; if (![...accepted.values()].includes(paragraph)) return block;
    if (/<w:pageBreakBefore(?:\s[^>]*)?\/?\s*>/.test(block)) return block;
    changed++;
    if (/<w:pPr(?:\s[^>]*)?>/.test(block)) return block.replace(/<w:pPr(?:\s[^>]*)?>/, "$&<w:pageBreakBefore/>");
    return block.replace(/^(<w:p(?:\s[^>]*)?>)/, "$1<w:pPr><w:pageBreakBefore/></w:pPr>");
  });
  zip[key] = strToU8(xml); await writeFile(outputPath, zipSync(zip, { level: 6 })); return changed;
}
