import { beforeAll, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { extractFromDocx } from "@engine/ooxml-model";
import { registryProvider } from "@engine/font-system";
import { buildScene } from "@engine/scene";

const JAZEERA = new URL("../../../corpus/book-fonts/Al-Jazeera-Arabic-Regular.ttf", import.meta.url);
const AHADITH = new URL("../../../corpus/books/sample-ahadith.docx", import.meta.url);

let model: any;
beforeAll(() => {
  model = extractFromDocx(readFileSync(AHADITH));
});

describe("diag", () => {
  it("print overflows", async () => {
    const jazeera = readFileSync(JAZEERA);
    const provider = registryProvider({ "al-jazeera arabic": jazeera, "al-jazeera-arabic-regular": jazeera }, "Al-Jazeera-Arabic-Regular");
    const doc = await buildScene(model, provider);
    for (const pg of doc.pages) {
      const bottom = pg.heightTwips - pg.marBottomTwips;
      for (const par of pg.paragraphs) {
        for (const ln of par.lines) {
          const bottomOfGlyph = ln.yTwips + ln.descentTwips;
          if (bottomOfGlyph > bottom + 1) {
            console.log(`PAGE ${pg.index} bottom=${bottom} glyphBottom=${bottomOfGlyph} over=${bottomOfGlyph - bottom}`);
            console.log(`  line h=${ln.heightTwips} asc=${ln.ascentTwips} desc=${ln.descentTwips} gap=${ln.lineGapTwips} y=${ln.yTwips}`);
            console.log(`  words: ${ln.words.map((w: any) => `"${w.text}"(em=${w.emTwips},asc=${w.ascentTwips.toFixed(1)},desc=${w.descentTwips.toFixed(1)},gap=${w.gapTwips.toFixed(1)})`).join(" ")}`);
          }
        }
      }
    }
    console.log(`total pages: ${doc.pages.length}`);
  });
});
