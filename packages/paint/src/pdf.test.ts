import { describe, expect, it } from "vitest";
import { assemblePdf } from "./pdf.js";

const tinyJpeg = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01,
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
]);

describe("assemblePdf", () => {
  it("writes valid page-tree references and absolute xref offsets", () => {
    const bytes = assemblePdf([{ wPt: 100, hPt: 200, jpeg: tinyJpeg }]);
    const pdf = new TextDecoder("latin1").decode(bytes);

    const pagesMatch = pdf.match(/(\d+) 0 obj\n<< \/Type \/Pages /);
    expect(pagesMatch).not.toBeNull();
    expect(pdf).toContain(`/Parent ${pagesMatch![1]} 0 R`);

    const firstObjectOffset = Number(pdf.match(/xref\n0 \d+\n0000000000 65535 f \n(\d{10})/)![1]);
    expect(new TextDecoder("latin1").decode(bytes.slice(firstObjectOffset))).toMatch(/^1 0 obj/);
  });
});
