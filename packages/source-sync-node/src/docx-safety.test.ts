import { describe, expect, it } from "vitest";
import { inspectDocxContainer } from "./docx-safety.js";

describe("DOCX container preflight", () => {
  it("accepts a bounded container with the required DOCX parts", () => {
    expect(inspectDocxContainer(zip([
      ["[Content_Types].xml", '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
      ["word/document.xml", "document"],
    ]))).toEqual({ kind: "accepted" });
  });

  it("quarantines corrupt, path-traversing, incomplete, and zip-bomb-shaped inputs", () => {
    expect(inspectDocxContainer(new TextEncoder().encode("not a zip"))).toMatchObject({ kind: "quarantined" });
    expect(inspectDocxContainer(zip([
      ["[Content_Types].xml", "types"], ["../word/document.xml", "document"],
    ]))).toMatchObject({ reason: "unsafe_entry_path" });
    expect(inspectDocxContainer(zip([["[Content_Types].xml", "types"]])))
      .toMatchObject({ reason: "missing_required_part" });
    expect(inspectDocxContainer(zip([
      ["[Content_Types].xml", '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'], ["word/document.xml", "document"],
    ]), { maxUncompressedBytes: 5 })).toMatchObject({ reason: "expanded_size_limit" });
  });
});

function zip(entries: Array<[string, string]>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;
  for (const [nameText, contentText] of entries) {
    const name = encoder.encode(nameText);
    const content = encoder.encode(contentText);
    const local = new Uint8Array(30 + name.length + content.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, content.length, true);
    lv.setUint32(22, content.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(content, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(20, content.length, true);
    cv.setUint32(24, content.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, localOffset, true);
    central.set(name, 46);
    centrals.push(central);
    localOffset += local.length;
  }
  const centralSize = centrals.reduce((sum, value) => sum + value.length, 0);
  const result = new Uint8Array(localOffset + centralSize + 22);
  let offset = 0;
  for (const part of [...locals, ...centrals]) { result.set(part, offset); offset += part.length; }
  const end = new DataView(result.buffer, offset, 22);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, localOffset, true);
  return result;
}
