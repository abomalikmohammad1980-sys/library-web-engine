import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { validateBokIntake, validateEpubIntake, validatePdfIntake, validateTextIntake } from "./multi-format-intake.js";

const encoder = new TextEncoder();
const archive = { maxBytes: 2_000_000, maxEntries: 32, maxExpandedBytes: 3_000_000, maxCompressionRatio: 1_000 };

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = Math.imul(state ^ state >>> 15, 1 | state), state ^= state + Math.imul(state ^ state >>> 7, 61 | state), ((state ^ state >>> 14) >>> 0) / 4_294_967_296));
}

function utf16(value: string, bigEndian: boolean): Uint8Array {
  const out = new Uint8Array(2 + value.length * 2);
  out.set(bigEndian ? [0xfe, 0xff] : [0xff, 0xfe]);
  const view = new DataView(out.buffer);
  for (let index = 0; index < value.length; index += 1) view.setUint16(2 + index * 2, value.charCodeAt(index), !bigEndian);
  return out;
}

function corruptEocd(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const out = bytes.slice();
  for (let index = out.length - 22; index >= 0; index -= 1) {
    if (out[index] === 0x50 && out[index + 1] === 0x4b && out[index + 2] === 0x05 && out[index + 3] === 0x06) {
      new DataView(out.buffer).setUint16(index + offset, value, true);
      return out;
    }
  }
  throw new Error("fixture_eocd_missing");
}

describe("seeded multi-format intake properties", () => {
  it("keeps PDF signature, bounds, truncation, and active-content decisions stable", () => {
    const random = seeded(0x50444631), policy = { maxBytes: 20_000, maxObjects: 12, maxDeclaredStreamBytes: 512 };
    for (let run = 0; run < 80; run += 1) {
      const objects = 1 + Math.floor(random() * 10), length = 1 + Math.floor(random() * 500);
      const body = `%PDF-1.${Math.floor(random() * 8)}\n${Array.from({ length: objects }, (_, i) => `${i + 1} 0 obj <</Length ${length}>> endobj`).join("\n")}\n%%EOF`;
      const valid = encoder.encode(body);
      expect(validatePdfIntake(valid, policy)).toEqual({ kind: "allow" });
      const badSignature = valid.slice(); badSignature[0] ^= 0xff;
      expect(validatePdfIntake(badSignature, policy)).toMatchObject({ kind: "reject", reason: "invalid_signature" });
      expect(validatePdfIntake(valid.subarray(0, valid.length - (1 + Math.floor(random() * 5))), policy)).toMatchObject({ kind: "reject", reason: "truncated_pdf" });
      expect(validatePdfIntake(encoder.encode(body.replace("%%EOF", "/JavaScript\n%%EOF")), policy)).toMatchObject({ kind: "quarantine", reason: "pdf_active_content" });
    }
  });

  it("round-trips seeded UTF BOM text and rejects malformed or odd encodings", () => {
    const random = seeded(0x554e4943), policy = { maxBytes: 8_000, maxCodePoints: 1_000, maxLineCodePoints: 1_000 };
    const alphabet = [..."ابتثجحخدذرزسشصضطظعغفقكلمنهوي ABC xyz ١٢٣"];
    for (let run = 0; run < 100; run += 1) {
      const value = Array.from({ length: 1 + Math.floor(random() * 80) }, () => alphabet[Math.floor(random() * alphabet.length)]!).join("");
      expect(validateTextIntake(encoder.encode(value), policy)).toMatchObject({ kind: "allow", encoding: "utf-8" });
      expect(validateTextIntake(utf16(value, false), policy)).toMatchObject({ kind: "allow", encoding: "utf-16le" });
      expect(validateTextIntake(utf16(value, true), policy)).toMatchObject({ kind: "allow", encoding: "utf-16be" });
      expect(validateTextIntake(new Uint8Array([0xc2, 0x20 + Math.floor(random() * 0x5f)]), policy)).toMatchObject({ kind: "reject", reason: "invalid_text_encoding" });
      expect(validateTextIntake(new Uint8Array([0xff, 0xfe, Math.floor(random() * 256)]), policy)).toMatchObject({ kind: "reject", reason: "invalid_text_encoding" });
    }
  });

  it("rejects seeded EPUB/BOK traversal, ratio, EOCD corruption, and truncation", () => {
    const random = seeded(0x5a495031);
    for (let run = 0; run < 60; run += 1) {
      const payload = encoder.encode("ا".repeat(500 + Math.floor(random() * 2_000)));
      const epub = zipSync({ mimetype: encoder.encode("application/epub+zip"), "META-INF/container.xml": encoder.encode("<container/>"), [`OEBPS/${run}.xhtml`]: payload });
      const bok = zipSync({ [`db/${run}.bok`]: encoder.encode("SQLite format 3\0safe") });
      expect(validateEpubIntake(epub, { ...archive, maxMarkupBytes: 10_000 }).kind).toBe("allow");
      expect(validateBokIntake(bok, { ...archive, maxDatabaseBytes: 2_000_000 }).kind).toBe("allow");
      const cut = 1 + Math.floor(random() * Math.min(20, epub.length - 1));
      expect(validateEpubIntake(epub.subarray(0, epub.length - cut), { ...archive, maxMarkupBytes: 10_000 })).toMatchObject({ kind: "reject", reason: "invalid_zip" });
      expect(validateBokIntake(bok.subarray(0, bok.length - cut), { ...archive, maxDatabaseBytes: 2_000_000 })).toMatchObject({ kind: "reject", reason: "invalid_zip" });
      expect(validateEpubIntake(corruptEocd(epub, 4, 1), { ...archive, maxMarkupBytes: 10_000 })).toMatchObject({ kind: "reject", reason: "invalid_zip" });
      expect(validateBokIntake(corruptEocd(bok, 8, 0), { ...archive, maxDatabaseBytes: 2_000_000 })).toMatchObject({ kind: "reject", reason: "invalid_zip" });
      const traversal = random() < 0.5 ? `../escape-${run}.xhtml` : `/absolute-${run}.xhtml`;
      expect(validateEpubIntake(zipSync({ [traversal]: payload }), { ...archive, maxMarkupBytes: 10_000 })).toMatchObject({ kind: "reject", reason: "unsafe_entry_path" });
      expect(validateEpubIntake(epub, { ...archive, maxCompressionRatio: 1, maxMarkupBytes: 10_000 })).toMatchObject({ kind: "reject", reason: "compression_ratio_limit" });
    }
  });
});
