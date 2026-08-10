import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractFromDocx } from "@engine/ooxml-model";
import { paintImagePayload } from "./imagePayload.js";

const MASJID = new URL("../../../corpus/books/sample-masjid.docx", import.meta.url);

describe.runIf(existsSync(MASJID))("scene paint — EMF corpus", () => {
  it("يحول وسائط sample-masjid الأربعة إلى payload متصفح قبل Blob", () => {
    const model = extractFromDocx(readFileSync(MASJID));
    const targets = [...new Set(model.paragraphs.flatMap(paragraph => paragraph.anchors)
      .map(anchor => anchor.rId ? model.relTargets.get(anchor.rId) : undefined)
      .filter((target): target is string => Boolean(target && /\.emf$/i.test(target))))];
    expect(targets).toEqual(["media/image5.emf", "media/image7.emf", "media/image9.emf", "media/image10.emf"]);
    for (const target of targets) {
      const bytes = model.mediaFiles.get(target.replace(/^media\//, ""));
      expect(bytes).toBeDefined();
      const payload = paintImagePayload(bytes!);
      expect(payload?.mime).toBe("image/png");
      expect([...payload!.bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  });
});
