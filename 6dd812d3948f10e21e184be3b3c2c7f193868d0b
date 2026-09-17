/**
 * مولد PDF (v1) — ترسيمٌ ذاتيٌّ عملي: يلتقط كلَّ صفحةٍ Canvas إلى JPEG ويضمّنها
 * كصورةٍ لكل صفحة PDF. نقاطُ الصفحة = twips/20 (القياس المطبعي الحقيقي).
 *
 * لماذا JPEG لا PNG: PNG يحتاج فكّ ضغطٍ ثم Flate للمسح الخام، بينما JPEG يُضمَّن
 * مباشرةً (‏/DCTDecode). نسخةُ المسارات النصّية الفعلية بنيةٌ لاحقة عند الحاجة
 * (تحرير/نسخ) — هذه أولُ مخرجاتٍ تُطابق ما يراه القارئ بصريًا.
 */

import type { SceneDocument } from "@engine/scene";
import { pagePoints } from "./units.js";
import { renderPageToCanvasSettled } from "./canvas.js";

export interface PdfOptions {
  /** مقياسُ التقاط الصفحة (dpr) — الدقة الافتراضية 2 للوضوح */
  scale?: number;
  /** جودة JPEG (0..1) */
  quality?: number;
}

/** ‏canvas ⟵ JPEG bytes (async) */
function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error("toBlob فشل")); return; }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/jpeg", quality);
  });
}

/** يبني مستند PDF بسيطًا من مصفوفة الصفحات وبيانات JPEG. */
export function assemblePdf(
  pages: { wPt: number; hPt: number; jpeg: Uint8Array }[],
): Uint8Array {
  const out: string[] = [];
  const objects: { body: string; stream?: Uint8Array }[] = [];
  let objNum = 1;

  const add = (body: string, stream?: Uint8Array): number => {
    const n = objNum++;
    if (stream !== undefined) objects.push({ body, stream });
    else objects.push({ body });
    return n;
  };

  // احجز شجرة الصفحات أولًا كي تكون إحالة /Parent معروفة قبل إنشاء الصفحات.
  const pagesRef = add("");
  const pageObjIds: number[] = [];
  for (const pg of pages) {
    const imgRef = add(
      `<< /Type /XObject /Subtype /Image /Width ${imgWidth(pg)} /Height ${imgHeight(pg)}` +
      ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>`,
      pg.jpeg,
    );
    const content = `q\n${pg.wPt.toFixed(2)} 0 0 ${pg.hPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentRef = add(
      `<< /Length ${content.length} >>`,
      new TextEncoder().encode(content),
    );
    pageObjIds.push(add(
      `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pg.wPt.toFixed(2)} ${pg.hPt.toFixed(2)}]` +
      ` /Resources << /XObject << /Im0 ${imgRef} 0 R >> >> /Contents ${contentRef} 0 R >>`,
    ));
  }

  const kids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objects[pagesRef - 1]!.body = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjIds.length} >>`;
  const catalogRef = add(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

  // تجميع البايتات
  const chunks: Uint8Array[] = [];
  const pushStr = (s: string) => chunks.push(new TextEncoder().encode(s));
  pushStr("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");
  const offsets: number[] = [];
  let offset = chunks.reduce((a, c) => a + c.length, 0);
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    offsets.push(offset);
    const head = `${i + 1} 0 obj\n`;
    const tail = o.stream ? `\nstream\n` : `\n`;
    const end = o.stream ? `\nendstream\nendobj\n` : `\nendobj\n`;
    pushStr(head + o.body + tail);
    if (o.stream) chunks.push(o.stream!);
    pushStr(end);
    offset = chunks.reduce((a, c) => a + c.length, 0);
  }
  const xrefStart = chunks.reduce((a, c) => a + c.length, 0);
  pushStr(`xref\n0 ${objects.length + 1}\n`);
  pushStr("0000000000 65535 f \n");
  for (const off of offsets) pushStr(`${off.toString().padStart(10, "0")} 00000 n \n`);
  pushStr(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`,
  );

  const total = chunks.reduce((a, c) => a + c.length, 0);
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  return all;
}

function imgWidth(pg: { wPt: number; hPt: number; jpeg: Uint8Array }): number {
  const d = pngJpegDims(pg.jpeg);
  return d?.w ?? Math.round(pg.wPt * 2);
}
function imgHeight(pg: { wPt: number; hPt: number; jpeg: Uint8Array }): number {
  const d = pngJpegDims(pg.jpeg);
  return d?.h ?? Math.round(pg.hPt * 2);
}

/** أبعاد JPEG من رأس SOF0/SOF2 — لا حاجة لفكّ كامل. */
export function pngJpegDims(data: Uint8Array): { w: number; h: number } | null {
  if (data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) { i++; continue; }
    const marker = data[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = (data[i + 2]! << 8) | data[i + 3]!;
    if (len === 0) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { h: (data[i + 5]! << 8) | data[i + 6]!, w: (data[i + 7]! << 8) | data[i + 8]! };
    }
    i += 2 + len;
  }
  return null;
}

/** الصفحات ⟵ JPEG ثم يُجمَّع PDF. */
export async function renderDocumentToPdf(
  doc: SceneDocument, opts: PdfOptions = {},
): Promise<Uint8Array> {
  const scale = opts.scale ?? 2;
  const quality = opts.quality ?? 0.92;
  const pages: { wPt: number; hPt: number; jpeg: Uint8Array }[] = [];
  for (const page of doc.pages) {
    const { w, h } = pagePoints(page.widthTwips, page.heightTwips);
    const canvas = await renderPageToCanvasSettled(page, doc, { scale, background: "#ffffff" });
    pages.push({ wPt: w, hPt: h, jpeg: await canvasToJpeg(canvas, quality) });
  }
  return assemblePdf(pages);
}
