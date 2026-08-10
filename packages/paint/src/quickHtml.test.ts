import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { extractFromDocx } from "@engine/ooxml-model";
import type { BodyParagraph } from "@engine/ooxml-model";
import { jcCss, quickNoteEntries, quickParagraphLineHeight, quickParagraphVisible, quickTableCellGroups, quickTableOwnership } from "./quickHtml.js";

const USUS = new URL("../../../../../كتب للاختبار/أُسس قوام الشخصية الفاعلة.. شرح سورة الشرح.docx", import.meta.url);
const OPENXML_GREETING_LINE = new URL("../../../tmp/Word external QA/OpenXmlSdk-GreetingLine/greeting-line.docx", import.meta.url);
const OPENXML_TABLE_CELL_2_PARA = new URL("../../../tmp/Word external QA/OpenXmlSdk-TableCell2Para/table-cell-2-para.docx", import.meta.url);
const OPENXML_HYPERLINK_TABLE = new URL("../../../tmp/Word external QA/OpenXmlSdk-HyperlinkInTable/hyperlink-in-table.docx", import.meta.url);

const paragraph = (line: number, lineRule: "auto" | "exact" | "atLeast") => ({
  spacing: { line, lineRule },
} as BodyParagraph);

describe("quick Word HTML paragraph fidelity", () => {
  it("keeps physical alignment independent from bidi direction", () => {
    expect(jcCss("left")).toBe("left");
    expect(jcCss("right")).toBe("right");
    expect(jcCss("start")).toBe("start");
    expect(jcCss("both")).toBe("justify");
  });

  it("does not compress auto line spacing below natural glyph bounds", () => {
    expect(quickParagraphLineHeight(paragraph(192, "auto"))).toBe("normal");
    expect(quickParagraphLineHeight(paragraph(360, "auto"))).toBe("1.5");
    expect(quickParagraphLineHeight(paragraph(192, "exact"))).toBe("9.6pt");
  });
});

describe.runIf(existsSync(USUS))("quick Word HTML notes — corpus", () => {
  it("يجمع حاشية Word متعددة الفقرات في مدخل واحد بعلامة واحدة", () => {
    const model = extractFromDocx(readFileSync(USUS));
    const entry = quickNoteEntries(model).find(item => item.id === "18");
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({ kind: "footnote", marker: "18" });
    expect(entry!.paragraphs).toHaveLength(2);
    expect(entry!.paragraphs.map(item => item.text)).toEqual([
      expect.stringContaining("صحيح البخاري"),
      expect.stringContaining("صحيح مسلم"),
    ]);
    expect(quickNoteEntries(model).some(item => item.id === "-1" || item.id === "0")).toBe(false);
  });
});

describe.runIf(existsSync(OPENXML_GREETING_LINE))("quick Word HTML — cached field result", () => {
  it("يمرر فقرة GREETINGLINE المرئية إلى مخرج paint السريع", () => {
    const model = extractFromDocx(readFileSync(OPENXML_GREETING_LINE));
    expect(model.paragraphs[0]!.text).toBe("«GreetingLine»");
    expect(quickParagraphVisible(model.paragraphs[0]!)).toBe(true);
  });
});

describe.runIf(existsSync(OPENXML_TABLE_CELL_2_PARA))("quick Word HTML — multi-paragraph cell", () => {
  it("يجمع فقرتي الخلية الرسمية في td واحدة وبترتيبهما", () => {
    const model = extractFromDocx(readFileSync(OPENXML_TABLE_CELL_2_PARA));
    const groups = quickTableCellGroups(model.paragraphs.filter(paragraph => paragraph.tableCell));
    const firstCell = groups.find(group => group[0]!.tableCell?.row === 0
      && group[0]!.tableCell?.col === 0);
    expect(firstCell?.map(paragraph => paragraph.text)).toEqual([
      "Paragraph inside a table cell", "Para2 inside a table cell",
    ]);
    expect(groups).toHaveLength(12);
  });
});

describe.runIf(existsSync(OPENXML_HYPERLINK_TABLE))("quick Word HTML — nested table ownership", () => {
  it("يحفظ الجدول الداخلي في الخلية الأولى من الأب بدل تسطيح صفوفه", () => {
    const model = extractFromDocx(readFileSync(OPENXML_HYPERLINK_TABLE));
    const tables = quickTableOwnership(model.paragraphs);
    const byId = new Map(tables.map(table => [table.tableId, table]));
    expect(tables).toHaveLength(2);
    expect(byId.get(0)).toMatchObject({ tableId: 0, nestingDepth: 0 });
    expect(byId.get(0)!.parentTableId).toBeUndefined();
    expect(byId.get(1)).toMatchObject({
      tableId: 1, parentTableId: 0, parentRow: 0, parentCol: 0, nestingDepth: 1,
    });
    expect(byId.get(1)!.paragraphs.flatMap(paragraph => paragraph.runs)
      .some(run => run.href === "http://www.ecma.org/")).toBe(true);
  });
});
