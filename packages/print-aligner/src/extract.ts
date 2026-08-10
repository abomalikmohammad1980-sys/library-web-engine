import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractFromDocx } from "@engine/ooxml-model";
import { excerpt, normalizeArabic } from "./normalize.js";
import type { PdfPageText } from "./types.js";

export const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export async function readFingerprinted(path: string) { const bytes = new Uint8Array(await readFile(path)); return { bytes, sha256: sha256(bytes) } }

export async function extractPdfPages(bytes: Uint8Array): Promise<PdfPageText[]> {
  const dir = await mkdtemp(join(tmpdir(), "khizana-print-align-")); const input = join(dir, "input.pdf");
  try {
    await writeFile(input, bytes);
    let text: string;
    try { text = await run("pdftotext", ["-enc", "UTF-8", "-layout", input, "-"]); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes("ENOENT")) throw error;
      const script = "import sys,pdfplumber\nsys.stdout.reconfigure(encoding='utf-8')\np=pdfplumber.open(sys.argv[1])\nsys.stdout.write('\\f'.join((x.extract_text(layout=True) or '') for x in p.pages))";
      text = await run(process.env.KHIZANA_PYTHON ?? "python", ["-c", script, input]);
    }
    const rawPages = text.replace(/\r/g, "").split("\f"); if (!rawPages.at(-1)?.trim()) rawPages.pop();
    return rawPages.map((raw, index) => { const value = raw.replace(/[ \t]+$/gm, "").trim(); const normalized = normalizeArabic(value);
      return { page: index + 1, text: value, normalized, method: usableArabicTextLayer(value) ? "text-layer" : "empty-needs-ocr" }; });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

export function usableArabicTextLayer(value: string): boolean {
  const arabic = (value.match(/[\u0600-\u06FF]/g) ?? []).length;
  const letters = (value.match(/\p{L}/gu) ?? []).length;
  const cid = (value.match(/\(cid:\d+\)/g) ?? []).length;
  const controls = (value.match(/[\u0000-\u0008\u000B\u000E-\u001F]/g) ?? []).length;
  return arabic >= 24 && arabic / Math.max(letters, 1) >= .35 && cid < Math.max(5, arabic / 8) && controls < 4;
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolveRun, reject) => execFile(command, args, { windowsHide: true, maxBuffer: 256 * 1024 * 1024 },
    (error, stdout, stderr) => error ? reject(new Error(`pdf_text_extraction_failed:${stderr || error.message}`)) : resolveRun(stdout)));
}

export function extractDocxParagraphs(bytes: Uint8Array) {
  return extractFromDocx(bytes).paragraphs.map(p => ({ index: p.index, text: p.text, normalized: normalizeArabic(p.text),
    excluded: p.excluded, preview: excerpt(p.text) }));
}
