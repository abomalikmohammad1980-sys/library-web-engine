/** الخطوط: تحويل اسم العائلة إلى CSS، وتسجيل الخطوط المضمّنة (word/fonts)
 *  عبر FontFace API مع استخراج اسم العائلة من جدول name للـ TTF/OTF. */

import { ARABIC_FALLBACK } from "./units.js";
import type { DocumentModelV0 } from "@engine/ooxml-model";

/** اسم العائلة ⟵ قائمة CSS آمنة مع سلسلة خطوط عربية احتياطية. */
export function cssFamily(family: string | null): string {
  if (!family) return ARABIC_FALLBACK;
  const safe = family.replace(/'/g, "").trim();
  if (!safe) return ARABIC_FALLBACK;
  return `'${safe}',${ARABIC_FALLBACK}`;
}

/** يسجّل كل الخطوط المضمّنة في النموذج عبر FontFace (متصفح فقط).
 *  لا يُلقي إذا فشل خطٌّ — يُسجَّل ما ينجح ويُستكمل الباقي. */
export async function registerEmbeddedFonts(model: DocumentModelV0): Promise<void> {
  if (!model.embeddedFonts.size) return;
  if (!(globalThis as Record<string, unknown>).FontFace || !globalThis.document?.fonts) return;
  const tasks: Promise<void>[] = [];
  for (const [fileName, face] of model.embeddedFonts) {
    const family = face.family ?? extractFontFamily(face.data) ?? fileName.replace(/\.\w+$/, "");
    try {
      const bytes = face.data.slice().buffer as ArrayBuffer;
      const font = new FontFace(family, bytes, { style: face.style, weight: face.weight });
      tasks.push(
        font.load().then(() => {
          // بعض إصدارات TS لا تعرّف add على FontFaceSet — نستدعيها بأمان
          const set = globalThis.document.fonts as unknown as { add(f: FontFace): void };
          set.add(font);
        }).catch(() => undefined),
      );
    } catch {
      /* خطٌّ مكسور — يُتجاوز ولا يوقف المستند */
    }
  }
  await Promise.allSettled(tasks);
  try {
    await globalThis.document.fonts.ready;
  } catch {
    /* بعض المتصفحات لا تملك ready — نتجاهل */
  }
}

/** استخراج اسم العائلة (Name ID 1) من بايتات TTF/OTF — أو null عند الفشل. */
export function extractFontFamily(data: Uint8Array): string | null {
  try {
    if (data.byteLength < 16) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const numTables = view.getUint16(4, false);
    let offset = 12;
    for (let i = 0; i < numTables; i++) {
      if (offset + 16 > data.byteLength) break;
      const tag = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3),
      );
      if (tag === "name") return parseNameTable(data, view.getUint32(offset + 8, false));
      offset += 16;
    }
  } catch {
    /* جداول تالفة */
  }
  return null;
}

function parseNameTable(data: Uint8Array, offset: number): string | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (offset + 6 > data.byteLength) return null;
    const count = view.getUint16(offset + 2, false);
    const stringOffset = view.getUint16(offset + 4, false);
    for (let i = 0; i < count; i++) {
      const rec = offset + 6 + i * 12;
      if (rec + 12 > data.byteLength) break;
      const platformID = view.getUint16(rec, false);
      const nameID = view.getUint16(rec + 6, false);
      if (nameID === 1 && (platformID === 3 || platformID === 1)) {
        const len = view.getUint16(rec + 8, false);
        const strOff = view.getUint16(rec + 10, false);
        const base = offset + stringOffset + strOff;
        if (base + len > data.byteLength) continue;
        const bytes = new Uint8Array(data.buffer, data.byteOffset + base, len);
        if (platformID === 3) {
          const chars: string[] = [];
          for (let j = 0; j + 1 < len; j += 2) {
            const code = (bytes[j]! << 8) | bytes[j + 1]!;
            if (code === 0) break;
            chars.push(String.fromCharCode(code));
          }
          return chars.join("");
        }
        try {
          return new TextDecoder("macintosh").decode(bytes);
        } catch {
          return String.fromCharCode(...Array.from(bytes));
        }
      }
    }
  } catch {
    /* جداول تالفة */
  }
  return null;
}
