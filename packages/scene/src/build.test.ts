import { describe, expect, it, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { extractFromDocx, parseDocument, parseStyles } from "@engine/ooxml-model";
import type { BodyParagraph, DocumentModelV0, SectionGeometry } from "@engine/ooxml-model";
import { registryProvider } from "@engine/font-system";
import { buildScene, footerBodyClearance, groupSceneTableSources, headerBodyClearance, keptParagraphNeedsFreshPage, nextRenderableParagraphIndexes, resolvedSceneLineHeight, sceneTableStart, squareWrapTextRegion, tightWrapHorizontalBounds, tableRowFragmentHeight, tableRowPageDecision, widowOrphanLineFit, wordKerningFeatures } from "./index.js";

const JAZEERA = new URL("../../../corpus/book-fonts/Al-Jazeera-Arabic-Regular.ttf", import.meta.url);
const AHADITH = new URL("../../../corpus/books/sample-ahadith.docx", import.meta.url);
const MUQTARAH = new URL("../../../corpus/books/sample-muqtarah.docx", import.meta.url);
const TADRIS = new URL("../../../corpus/books/sample-tadris.docx", import.meta.url);
const MASJID = new URL("../../../corpus/books/sample-masjid.docx", import.meta.url);
const JALSA = new URL("../../../corpus/books/sample-jalsa27.docx", import.meta.url);
const MINHAJ_CAMP = new URL("../../../../../كتب للاختبار/منهاج مخيم جيل العزة - المخيم الصيفي لمدة أسبوع.docx", import.meta.url);
const SHAMI = new URL("../../../../../../الكتب والمقالات/أبو أنس الشامي.. عمر يوسف جمعة/سيرة الشيخ أبي أنس الشامي - أبو حمزة المهاجر.docx", import.meta.url);
const SUROOR = new URL("../../../../../../الكتب والمقالات/أبو أنس الشامي.. عمر يوسف جمعة/سرور.. بل أحزان.docx", import.meta.url);
const IBHAJ = new URL("../../../docs/qa/publish-sanitized-staging/إبهاج أهل الصناعة بدراسة حديث بعثت بالسيف بين يدي الساعة - أبو ذر السمهري اليماني.docx", import.meta.url);
const HUMUM = new URL("../../../../../كتب للاختبار/همومٌ وآلام.. ديوان شعري.docx", import.meta.url);
const ZAHAR = new URL("../../../../../كتب للاختبار/زهر الخمائل في مسائل النوازل.docx", import.meta.url);
const FOOTNOTE_FIXTURE = new URL("../../../corpus/books/fn-test.docx", import.meta.url);
const USUS_NOTES = new URL("../../../../../كتب للاختبار/أُسس قوام الشخصية الفاعلة.. شرح سورة الشرح.docx", import.meta.url);
const OFFICEDEV_SAMPLE = new URL("../../../tmp/Word external QA/OfficeDev-SampleDoc/SampleDoc.docx", import.meta.url);
const OFFICEDEV_TEMPLATE = new URL("../../../tmp/Word external QA/OfficeDev-ImportTemplate/template-example.docx", import.meta.url);
const OPENXML_THAI_PAGE = new URL("../../../tmp/Word external QA/OpenXmlSdk-ThaiPageNumber/thai-page-number.docx", import.meta.url);
const OPENXML_BACKGROUND = new URL("../../../tmp/Word external QA/OpenXmlSdk-DocumentBackground/document-background.docx", import.meta.url);
const OPENXML_SECTION_BREAK = new URL("../../../tmp/Word external QA/OpenXmlSdk-SectionBreak/section-break.docx", import.meta.url);
const OPENXML_TABLE_CELL_2_PARA = new URL("../../../tmp/Word external QA/OpenXmlSdk-TableCell2Para/table-cell-2-para.docx", import.meta.url);
const OPENXML_COMPLEX_TABLE = new URL("../../../tmp/Word external QA/OpenXmlSdk-ComplexTable/complex-table.docx", import.meta.url);
const OPENXML_GREETING_LINE = new URL("../../../tmp/Word external QA/OpenXmlSdk-GreetingLine/greeting-line.docx", import.meta.url);
const OPENXML_HYPERLINK_TABLE = new URL("../../../tmp/Word external QA/OpenXmlSdk-HyperlinkInTable/hyperlink-in-table.docx", import.meta.url);

let jazeera: Uint8Array;
let ahadithModel: DocumentModelV0;
let muqtarahModel: DocumentModelV0;
let tadrisModel: DocumentModelV0;
let masjidModel: DocumentModelV0;
let jalsaModel: DocumentModelV0;

beforeAll(() => {
  jazeera = readFileSync(JAZEERA);
  ahadithModel = extractFromDocx(readFileSync(AHADITH));
  muqtarahModel = extractFromDocx(readFileSync(MUQTARAH));
  tadrisModel = extractFromDocx(readFileSync(TADRIS));
  masjidModel = extractFromDocx(readFileSync(MASJID));
  jalsaModel = extractFromDocx(readFileSync(JALSA));
});

function provider() {
  return registryProvider({ "al-jazeera arabic": jazeera, "al-jazeera-arabic-regular": jazeera }, "Al-Jazeera-Arabic-Regular");
}

describe("scene corpus — منهاج مخيم جيل العزة", () => {
  it("يبني الجداول ويكرر tblHeader الحقيقي ويحفظ vAlign دون exception", async () => {
    const camp = extractFromDocx(readFileSync(MINHAJ_CAMP));
    const scene = await buildScene(camp, provider());
    expect(camp.paragraphs).toHaveLength(558);
    expect(scene.pages.length).toBeGreaterThan(0);
    expect(scene.pages.reduce((count, page) => count + (page.tables?.length ?? 0), 0)).toBeGreaterThan(0);
    const sourceHeaderRows = new Set(camp.paragraphs.filter(p => p.tableCell?.repeatHeader)
      .map(p => `${p.tableCell!.tableId}:${p.tableCell!.row}`));
    const sourceAlignedCells = new Set(camp.paragraphs.filter(p =>
      p.tableCell?.vAlign === "center" || p.tableCell?.vAlign === "bottom")
      .map(p => `${p.tableCell!.tableId}:${p.tableCell!.row}:${p.tableCell!.col}`));
    const renderedHeaderRows = scene.pages.flatMap(page => page.tables ?? [])
      .flatMap(table => table.rows).filter(row => row.repeatHeader);
    expect(sourceHeaderRows.size).toBe(17);
    expect(sourceAlignedCells.size).toBe(333);
    expect(renderedHeaderRows.length).toBeGreaterThan(sourceHeaderRows.size);
    expect(new Set(renderedHeaderRows.map(row => `${row.tableId}:${row.row}`)).size)
      .toBe(sourceHeaderRows.size);
  });
});

describe.runIf(existsSync(SHAMI))("scene corpus — سيرة الشيخ أبي أنس الشامي", () => {
  it("يجعل الورقة الأولى غلافًا وحده ويبدأ المتن والرأس والتذييل من الثانية", async () => {
    const scene = await buildScene(extractFromDocx(readFileSync(SHAMI)), provider());
    // العدد الموثق 7 يأتي من WordPageMap/COM؛ scene المفتوح تقدير ولا يُقدَّم
    // بوصفه الحقيقة. هذا الانحدار يثبت ملكية الغلاف والطبقات فقط.
    expect(scene.pages.length).toBeGreaterThanOrEqual(2);
    expect(scene.pages[0]!.paragraphs).toHaveLength(0);
    expect(scene.pages[0]!.anchors).toHaveLength(1);
    expect(scene.pages[0]!.headerParas).toBeUndefined();
    expect(scene.pages[0]!.footerParas).toBeUndefined();
    expect(scene.pages[1]!.paragraphs.length).toBeGreaterThan(0);
    const headerText = (pageIndex: number) => scene.pages[pageIndex]!.headerParas
      ?.flatMap(paragraph => paragraph.lines).flatMap(line => line.words)
      .map(word => word.text).join(" ").trim();
    expect(headerText(1)).toBe("1");
    expect(headerText(2)).toBe("2");
    expect(scene.pages[1]!.anchors.length).toBeGreaterThanOrEqual(2);
    const headerBackground = scene.pages[1]!.anchors.find(anchor => anchor.hTwips === 975);
    const footerBackground = scene.pages[1]!.anchors.find(anchor => anchor.hTwips === 450);
    expect(headerBackground).toMatchObject({ behindDoc: true,
      xTwips: 567 - 11, yTwips: 709 - 424, wTwips: 10755 });
    expect(footerBackground).toMatchObject({ behindDoc: true,
      xTwips: 567 + 6, yTwips: 16838 - 709 + 6, wTwips: 10755 });
  });
});

describe.runIf(existsSync(SUROOR))("scene corpus — سرور بل أحزان", () => {
  it("لا يسمح لـ line=192 auto بتراكب صناديق السطور العربية", async () => {
    const scene = await buildScene(extractFromDocx(readFileSync(SUROOR)), provider());
    let checkedPairs = 0;
    for (const page of scene.pages) for (const paragraph of page.paragraphs) {
      for (let i = 1; i < paragraph.lines.length; i++) {
        const previous = paragraph.lines[i - 1]!;
        const current = paragraph.lines[i]!;
        expect(current.yTwips - current.ascentTwips)
          .toBeGreaterThanOrEqual(previous.yTwips + previous.descentTwips - 1);
        checkedPairs++;
      }
    }
    expect(checkedPairs).toBeGreaterThan(20);
  });
});

describe.runIf(existsSync(IBHAJ))("scene corpus — إبهاج أهل الصناعة", () => {
  it("يحوّل غلاف VML إلى إحداثيات الورقة x≈0 وعرض A4 دون قلب RTL", async () => {
    const scene = await buildScene(extractFromDocx(readFileSync(IBHAJ)), provider(), { maxPages: 2 });
    const cover = scene.pages.flatMap(page => page.anchors)
      .find(anchor => anchor.wTwips > scene.pages[0]!.widthTwips * .9);
    expect(cover).toBeDefined();
    expect(Math.abs(cover!.xTwips)).toBeLessThanOrEqual(6);
    expect(Math.abs(cover!.yTwips)).toBeLessThanOrEqual(1);
    expect(cover!.wTwips).toBeGreaterThanOrEqual(11906);
    expect(cover!.wTwips).toBeLessThanOrEqual(11920);
  });

  it("لا يحسب خط التذييل النسبي للفقرة عند أعلى الصفحة ولا يسحق المتن", async () => {
    const scene = await buildScene(extractFromDocx(readFileSync(IBHAJ)), provider(), { maxPages: 100 });
    // WordPageMap الموثق = 22 ورقة. اختلاف القياس مع خط fallback متوقع، لكن
    // الانحدار السابق كان 268 ورقة لأن خط التذييل حجز منطقة المتن كلها.
    expect(scene.pages.length).toBeLessThan(50);
    const ordinary = scene.pages.find(page => page.footerParas?.length);
    expect(ordinary).toBeDefined();
    expect(ordinary!.anchors.some(anchor => anchor.hTwips <= 1
      && anchor.yTwips > ordinary!.heightTwips / 2)).toBe(true);
    expect(ordinary!.paragraphs.flatMap(paragraph => paragraph.lines).length).toBeGreaterThan(10);
    expect(scene.fonts.some(font => font.family === "traditional arabic"
      && font.substituted && font.resolvedFamily === "Al-Jazeera-Arabic-Regular")).toBe(true);
  }, 60_000);
});

describe.runIf(existsSync(HUMUM))("scene corpus — هموم وآلام", () => {
  it("يحفظ w:br الشعري حد سطر ولا يرسّمه داخل غليف", async () => {
    const corpus = extractFromDocx(readFileSync(HUMUM));
    const manualBreakCount = corpus.paragraphs.reduce((sum, paragraph) =>
      sum + (paragraph.text.match(/\n/g)?.length ?? 0), 0);
    expect(manualBreakCount).toBeGreaterThan(1000);
    const source = corpus.paragraphs.find(paragraph => !paragraph.tableCell
      && paragraph.text.split("\n").filter(part => part.trim()).length >= 2);
    expect(source).toBeDefined();
    const scene = await buildScene(model([{ ...source!, index: 0, sectionIndex: 0 }]), provider());
    const lines = scene.pages.flatMap(page => page.paragraphs)
      .flatMap(paragraph => paragraph.lines);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.flatMap(line => line.words).some(word => word.text.includes("\n"))).toBe(false);
    expect(lines.slice(0, -1).some(line => line.words.at(-1)?.forcedBreakAfter)).toBe(true);
  });
});

describe.runIf(existsSync(ZAHAR))("scene corpus — زهر الخمائل", () => {
  it("لا يرسل w:tab إلى HarfBuzz ويحفظه مسافة جدولة مرئية", async () => {
    const corpus = extractFromDocx(readFileSync(ZAHAR));
    const tabCount = corpus.paragraphs.reduce((sum, paragraph) => sum + paragraph.tabAt.length, 0);
    expect(tabCount).toBeGreaterThan(150);
    const source = corpus.paragraphs.find(paragraph => !paragraph.tableCell
      && paragraph.text.includes("\t") && paragraph.text.replace(/\t/g, "").trim());
    expect(source).toBeDefined();
    const scene = await buildScene(model([{ ...source!, index: 0, sectionIndex: 0,
      excluded: false }]), provider());
    const words = scene.pages.flatMap(page => page.paragraphs)
      .flatMap(paragraph => paragraph.lines).flatMap(line => line.words);
    expect(words.some(word => word.text.includes("\t"))).toBe(false);
    expect(words.some(word => word.spaceBeforeTwips > 0)).toBe(true);
  });
});

describe("scene corpus — fn-test", () => {
  it("يصغّر علامة الحاشية ويرفع أساسها كما يصرح vertAlign", async () => {
    const corpus = extractFromDocx(readFileSync(FOOTNOTE_FIXTURE));
    const sourceRun = corpus.paragraphs.flatMap(paragraph => paragraph.runs)
      .find(run => run.superscript && run.noteRef);
    expect(sourceRun).toBeDefined();
    const source = corpus.paragraphs.find(paragraph => paragraph.runs.includes(sourceRun!));
    const scene = await buildScene(model([{ ...source!, index: 0, sectionIndex: 0,
      excluded: false }]), provider());
    const marker = scene.pages.flatMap(page => page.paragraphs)
      .flatMap(paragraph => paragraph.lines).flatMap(line => line.words)
      .find(word => word.text.includes(String(sourceRun!.noteRef!.num)));
    expect(marker).toBeDefined();
    expect(marker!.emTwips).toBeCloseTo((sourceRun!.emTwips ?? 240) * 0.58, 6);
    expect(marker!.baselineShiftTwips).toBeCloseTo((sourceRun!.emTwips ?? 240) * 0.4, 6);
  });
});

describe.runIf(existsSync(USUS_NOTES))("scene corpus — إحالة حاشية متعددة الفقرات", () => {
  it("يحمل رقم الإحالة 18 إلى المشهد مرة واحدة ولا يضاعفه بعدد فقرات المتن", async () => {
    const corpus = extractFromDocx(readFileSync(USUS_NOTES));
    expect(corpus.footnotes.get("18")).toHaveLength(2);
    const source = corpus.paragraphs.find(paragraph => paragraph.runs.some(run => run.noteRef?.id === "18"));
    expect(source).toBeDefined();
    const scene = await buildScene(model([{ ...source!, index: 0, sectionIndex: 0,
      excluded: false }]), provider());
    const markers = scene.pages.flatMap(page => page.paragraphs)
      .flatMap(paragraph => paragraph.lines).flatMap(line => line.words)
      .filter(word => word.text === "18");
    expect(markers).toHaveLength(1);
  });
});

describe.runIf(existsSync(OPENXML_GREETING_LINE))("scene corpus — Open XML SDK GREETINGLINE", () => {
  it("يحمل نتيجة الحقل المحفوظة إلى كلمات المشهد", async () => {
    const corpus = extractFromDocx(readFileSync(OPENXML_GREETING_LINE));
    const scene = await buildScene(corpus, provider());
    const text = scene.pages.flatMap(page => page.paragraphs).flatMap(paragraph => paragraph.lines)
      .flatMap(line => line.words).map(word => word.text).join("");
    expect(text).toContain("GreetingLine");
  });
});

// ---------- نموذج اصطناعي لاختبارات مضبوطة
const SECTION: SectionGeometry = {
  pageWTwips: 11906, pageHTwips: 16838,
  marLeftTwips: 1440, marRightTwips: 1440,
  marTopTwips: 1440, marBottomTwips: 1440,
  columnTwips: 9026, colCount: 1, colSpaceTwips: 0, colWidthTwips: 9026,
  pgNumFmt: null, pgNumStart: null, sectStart: "nextPage",
  docGridLinePitch: null, docGridType: null,
};

function para(text: string, over: Partial<BodyParagraph> = {}): BodyParagraph {
  return {
    index: 0,
    runs: [{ text, family: "Al-Jazeera-Arabic-Regular", emTwips: 240, hidden: false }],
    text,
    styleId: null, jc: "right", bidi: true,
    indLeft: 0, indRight: 0, indFirstLine: 0,
    excluded: false, sectionIndex: 0, numbered: false, numId: null, ilvl: null, anchors: [],
    spacing: { present: false, line: null, lineRule: null, before: null, after: null },
    markEmTwips: null, markAsciiFamily: null,
    pageBreakBefore: false, widowControl: true,
    tabStops: [], tabAt: [], ptabAt: [], toc: null,
    inlineImageHTwips: 0, tableCell: null, shd: null,
    ...over,
  };
}

function model(paragraphs: BodyParagraph[], section = SECTION): DocumentModelV0 {
  return {
    defaultTabStop: 720, section, sections: [section], paragraphs,
    compatibilityMode: 15,
    footnotes: new Map(), endnotes: new Map(), headerFooters: new Map(),
    relTargets: new Map(), partRels: new Map(), evenAndOddHeaders: false,
    mediaFiles: new Map(), embeddedFonts: new Map(),
  };
}

describe("scene build — synthetic", () => {
  it("يبني علامة القائمة من numFmt/lvlText/start لا من decimal ثابت", async () => {
    const source = para("بند", { numbered: true, numId: "7", ilvl: "0" });
    const numbered = model([source]);
    numbered.numbering = new Map([["7/0", { indLeft: null, indRight: null,
      indFirstLine: null, sz: null, markerFamily: null, markerBold: false,
      markerUnderline: null, markerColor: null, fmt: "upperRoman", lvlText: "(%1)",
      start: 4, jc: "right" }]]);
    const scene = await buildScene(numbered, provider());
    expect(scene.pages[0]!.paragraphs[0]!.markerText).toBe("(IV)");
  });
  it("يحل placeholders متعددة المستويات ويعيد الابن عند تقدم الأب", async () => {
    const numbered = model([
      para("أب أول", { index: 0, numbered: true, numId: "9", ilvl: "0" }),
      para("ابن أول", { index: 1, numbered: true, numId: "9", ilvl: "1" }),
      para("ابن ثان", { index: 2, numbered: true, numId: "9", ilvl: "1" }),
      para("أب ثان", { index: 3, numbered: true, numId: "9", ilvl: "0" }),
      para("ابن معاد", { index: 4, numbered: true, numId: "9", ilvl: "1" }),
    ]);
    const level = (fmt: string, lvlText: string) => ({ indLeft: null, indRight: null,
      indFirstLine: null, sz: null, markerFamily: null, markerBold: false,
      markerUnderline: null, markerColor: null, fmt, lvlText, start: 1, jc: "right" });
    numbered.numbering = new Map([
      ["9/0", level("upperRoman", "%1.")], ["9/1", level("decimal", "%1.%2)")],
    ]);
    const scene = await buildScene(numbered, provider());
    expect(scene.pages.flatMap(page => page.paragraphs).map(paragraph => paragraph.markerText))
      .toEqual(["I.", "I.1)", "I.2)", "II.", "II.1)"]);
  });
  it("يضيف w:spacing بين عناقيد المحارف وإلى المسافة بين الكلمات", async () => {
    const base = para("AB CD", { bidi: false, runs: [
      { text: "AB CD", family: "Al-Jazeera-Arabic-Regular", emTwips: 240,
        hidden: false, charSpacing: 30 },
    ] });
    const plain = { ...base, runs: base.runs.map(run => ({ ...run, charSpacing: 0 })) };
    const [spacedScene, plainScene] = await Promise.all([
      buildScene(model([base]), provider()), buildScene(model([plain]), provider()),
    ]);
    const spaced = spacedScene.pages[0]!.paragraphs[0]!.lines[0]!.words;
    const normal = plainScene.pages[0]!.paragraphs[0]!.lines[0]!.words;
    expect(spaced[0]!.advanceTwips - normal[0]!.advanceTwips).toBeCloseTo(30, 6);
    expect(spaced[1]!.spaceBeforeTwips - normal[1]!.spaceBeforeTwips).toBeCloseTo(30, 6);
  });
  it("يفصل تصغير super/sub عن w:position ويحسب صندوق السطر المزاح", async () => {
    const base = { family: "Al-Jazeera-Arabic-Regular", emTwips: 400, hidden: false };
    const source = para("س ع ص", { runs: [
      { ...base, text: "س" }, { ...base, text: " ع", superscript: true },
      { ...base, text: " ص", subscript: true, position: 20 },
    ] });
    const scene = await buildScene(model([source]), provider());
    const line = scene.pages[0]!.paragraphs[0]!.lines[0]!;
    const byText = new Map(line.words.map(word => [word.text, word]));
    expect(byText.get("ع")!.emTwips).toBeCloseTo(232, 6);
    expect(byText.get("ع")!.baselineShiftTwips).toBeCloseTo(160, 6);
    expect(byText.get("ص")!.emTwips).toBeCloseTo(232, 6);
    expect(byText.get("ص")!.baselineShiftTwips).toBeCloseTo(-140, 6);
    expect(line.ascentTwips).toBeGreaterThan(byText.get("ع")!.ascentTwips);
    expect(line.descentTwips).toBeGreaterThan(byText.get("ص")!.descentTwips);
  });
  it("يقفز w:tab إلى أول tab stop صريح بدل تشكيل محرف الجدولة", async () => {
    const source = para("A\tB", { bidi: false, jc: "left", tabAt: [1],
      tabStops: [{ val: "left", posTwips: 2000, leader: null }], runs: [
        { text: "A\tB", family: "Al-Jazeera-Arabic-Regular", emTwips: 240, hidden: false },
      ] });
    const scene = await buildScene(model([source]), provider());
    const words = scene.pages[0]!.paragraphs[0]!.lines[0]!.words;
    expect(words.map(word => word.text)).toEqual(["A", "B"]);
    expect(words[0]!.advanceTwips + words[1]!.spaceBeforeTwips).toBeCloseTo(2000, 6);
  });
  it("يكسر w:br داخل run وعبر run مستقل دون تسويغ السطر اليدوي", async () => {
    const source = para("الأول\nالثاني الثالث", { jc: "both", runs: [
      { text: "الأول", family: "Al-Jazeera-Arabic-Regular", emTwips: 240, hidden: false },
      { text: "\n", family: "Al-Jazeera-Arabic-Regular", emTwips: 240, hidden: false },
      { text: "الثاني الثالث", family: "Al-Jazeera-Arabic-Regular", emTwips: 240, hidden: false },
    ] });
    const scene = await buildScene(model([source]), provider());
    const lines = scene.pages[0]!.paragraphs[0]!.lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]!.words.map(word => word.text)).toEqual(["الأول"]);
    expect(new Set(lines[1]!.words.map(word => word.text))).toEqual(new Set(["الثاني", "الثالث"]));
    expect(lines[0]!.justified).toBe(false);
    expect(lines[0]!.words[0]!.forcedBreakAfter).toBe(true);
  });
  it("يطبق lineRule على صندوق الغليفات دون تداخل auto الصغير", () => {
    const spacing = (line: number, lineRule: "auto" | "exact" | "atLeast") => ({
      present: true, line, lineRule, before: 0, after: 0,
    });
    expect(resolvedSceneLineHeight(400, spacing(192, "auto"))).toBe(400);
    expect(resolvedSceneLineHeight(400, spacing(360, "auto"))).toBe(600);
    expect(resolvedSceneLineHeight(400, spacing(300, "exact"))).toBe(300);
    expect(resolvedSceneLineHeight(400, spacing(300, "atLeast"))).toBe(400);
    expect(resolvedSceneLineHeight(400, spacing(500, "atLeast"))).toBe(500);
  });
  it("يعلن استبدال عائلة Word في خط المشهد بدل إخفائه", async () => {
    const source = para("نص");
    const doc = await buildScene(model([{ ...source, runs: source.runs.map(run => ({
      ...run, family: "Traditional Arabic",
    })) }]), provider());
    expect(doc.fonts[0]).toMatchObject({ family: "traditional arabic",
      resolvedFamily: "Al-Jazeera-Arabic-Regular", substituted: true,
      resolutionSource: "fallback-family" });
  });
  it("يفرض maxPages داخل الفقرة الطويلة وحدود الصفحات لا بعد اكتمالها", async () => {
    const section = { ...SECTION, pageHTwips: 1600, marTopTwips: 200,
      marBottomTwips: 200, columnTwips: 2400, colWidthTwips: 2400 };
    const long = para("كلمة ".repeat(2000), { spacing: {
      present: true, line: 300, lineRule: "exact", before: 0, after: 0,
    } });
    const split = await buildScene(model([long], section), provider(), { maxPages: 2 });
    expect(split.pages).toHaveLength(2);
    const boundaries = await buildScene(model([para("نص", {
      pageBreakBefore: true, pageBreaksBefore: 4,
    })], section), provider(), { maxPages: 1 });
    expect(boundaries.pages).toHaveLength(1);
  });
  it("يفهرس الفقرة المتنية التالية خطيًا متجاوزًا الفراغ والجداول", () => {
    const body = para("متن");
    const blank = para("   ");
    const cell = para("خلية", { tableCell: { tableId: 1 } as never });
    const target = para("التالي");
    expect([...nextRenderableParagraphIndexes([body, blank, cell, target])])
      .toEqual([3, 3, 3, -1]);
  });
  it("يعطل HarfBuzz kerning تحت حد w:kern ويبقيه عند الحد وفوقه", () => {
    expect(wordKerningFeatures(310, 32)).toEqual(["-kern"]);
    expect(wordKerningFeatures(320, 32)).toBeUndefined();
    expect(wordKerningFeatures(400, 32)).toBeUndefined();
    expect(wordKerningFeatures(240, 0)).toBeUndefined();
    expect(wordKerningFeatures(240, undefined)).toBeUndefined();
  });
  it("يطبق w:w على عرض الغليف والمسافة ولا يغير ارتفاعه", async () => {
    const base = para("نص نص");
    const normal = await buildScene(model([base]), provider());
    const narrow = await buildScene(model([{ ...base, runs: base.runs.map(run => ({
      ...run, charScale: 50,
    })) }]), provider());
    const nw = normal.pages[0]!.paragraphs[0]!.lines[0]!.words;
    const cw = narrow.pages[0]!.paragraphs[0]!.lines[0]!.words;
    expect(cw[0]!.advanceTwips).toBeCloseTo(nw[0]!.advanceTwips * .5, 6);
    expect(cw[1]!.spaceBeforeTwips).toBeCloseTo(nw[1]!.spaceBeforeTwips * .5, 6);
    expect(cw[0]!.ascentTwips).toBeCloseTo(nw[0]!.ascentTwips, 6);
    expect(cw[0]!.horizontalScale).toBe(.5);
  });
  it("يجمع صفًا متعدد الخلايا ويحفظ span/borders/anchors ويقرر cantSplit", () => {
    const cell = (col: number, span: number, cantSplit: boolean, text: string) => para(text, {
      anchors: col === 1 ? [{ extentW: 10, extentH: 10 } as never] : [],
      tableCell: { tableId: 4, row: 2, col, colXTwips: col * 1000, colWTwips: span * 1000,
        gridSpan: span, firstInCell: true, firstInRow: col === 0, lastInRow: col === 1,
        shdFill: null, tblStyleId: null, totalGridTwips: 3000, tblWVal: 3000, tblWType: "dxa",
        tblLayout: "fixed", cantSplit, repeatHeader: false, bidiVisual: true, tblIndTwips: 0,
        tblJc: null, vMerge: null, vAlign: null, marTop: 0, marBottom: 0, marLeft: 108,
        marRight: 108, rowHeight: null, rowHeightRule: "auto", textDirection: null,
        tcBorders: { top: null, bottom: null, left: null, right: null } },
    });
    const grouped = groupSceneTableSources([cell(0, 1, true, "أ"), cell(1, 2, true, "ب")]);
    expect(grouped[0]!.rows[0]!.cells.map(c => c.tableCell.gridSpan)).toEqual([1, 2]);
    expect(grouped[0]!.rows[0]!.cells[1]!.paragraphs[0]!.anchors).toHaveLength(1);
    expect(tableRowPageDecision(900, 400, 1200, true)).toBe("move");
    expect(tableRowPageDecision(1400, 400, 1200, true)).toBe("split");
    expect(tableRowPageDecision(900, 400, 1200, false)).toBe("split");
  });
  it("يضع الجدول بحسب محاذاة Word الفيزيائية والاتجاه البصري", () => {
    const section = { ...SECTION, pageWTwips: 12000, marLeftTwips: 1000,
      marRightTwips: 2000, columnTwips: 9000 };
    const table = { totalGridTwips: 3000, tblIndTwips: 400, tblJc: null as string | null,
      bidiVisual: false };
    expect(sceneTableStart(section, table)).toBe(1400);
    expect(sceneTableStart(section, { ...table, tblJc: "center" })).toBe(4000);
    expect(sceneTableStart(section, { ...table, tblJc: "left" })).toBe(1000);
    expect(sceneTableStart(section, { ...table, tblJc: "right" })).toBe(7000);
    expect(sceneTableStart(section, { ...table, tblJc: "start", bidiVisual: true })).toBe(7000);
    expect(sceneTableStart(section, { ...table, tblJc: "end", bidiVisual: true })).toBe(1000);
  });
  it("يخرج cantSplit متعدد الخلايا في ScenePage.tables وينقله كاملًا", async () => {
    const section = { ...SECTION, pageHTwips: 2400, marTopTwips: 500, marBottomTwips: 500 };
    const ctx = (col: number) => ({ tableId: 9, row: 0, col, colXTwips: col * 1000,
      colWTwips: 1000, gridSpan: 1, firstInCell: true, firstInRow: col === 0, lastInRow: col === 1,
      shdFill: col ? "EEEEEE" : null, tblStyleId: null, totalGridTwips: 2000,
      tblWVal: 2000, tblWType: "dxa", tblLayout: "fixed" as const, cantSplit: true,
      repeatHeader: false, bidiVisual: true, tblIndTwips: 0, tblJc: null, vMerge: null,
      vAlign: null, marTop: 0, marBottom: 0, marLeft: 50, marRight: 50,
      rowHeight: 500, rowHeightRule: "atLeast", textDirection: null,
      tcBorders: { top: null, bottom: null, left: null, right: null } });
    const exact = { present: true, line: 300, lineRule: "exact" as const, before: 0, after: 0 };
    const doc = await buildScene(model([
      para("تمهيد", { spacing: { ...exact, after: 1000 } }),
      para("خلية أ", { spacing: exact, tableCell: ctx(0) }),
      para("خلية ب", { spacing: exact, tableCell: ctx(1) }),
    ], section), provider());
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0]!.tables).toHaveLength(0);
    const row = doc.pages[1]!.tables?.[0]?.rows[0];
    expect(row?.cells).toHaveLength(2);
    expect(row?.cells[1]?.shdFill).toBe("EEEEEE");
    expect(row?.cells.every(cell => cell.hTwips === row.hTwips)).toBe(true);
  });
  it("يشطر صف cantSplit الأطول من صفحة دون فقد أسطر الخلايا", async () => {
    const section = { ...SECTION, pageHTwips: 1400, marTopTwips: 200, marBottomTwips: 200 };
    const cell = { tableId: 12, row: 0, col: 0, colXTwips: 0, colWTwips: 2200,
      gridSpan: 1, vMerge: null, cantSplit: true, rowHeight: 2400, rowHeightRule: "atLeast" as const,
      marTop: 0, marRight: 0, marBottom: 0, marLeft: 0, tblIndTwips: 0,
      shdFill: null, tcBorders: null };
    const doc = await buildScene(model([
      para("سطر طويل داخل صف جدول", { tableCell: cell }),
    ], section), provider());
    expect(doc.pages.length).toBeGreaterThan(1);
    expect(doc.pages.flatMap(page => page.tables ?? []).flatMap(table => table.rows)
      .reduce((height, row) => height + row.hTwips, 0)).toBe(2400);
    expect(doc.pages.flatMap(page => page.tables ?? []).flatMap(table => table.rows)
      .flatMap(row => row.cells[0]?.paragraphs ?? []).flatMap(paragraph => paragraph.lines).length)
      .toBeGreaterThan(0);
  });
  it("يكرر سلسلة tblHeader قبل صفوف البيانات في كل صفحة تالية", async () => {
    const section = { ...SECTION, pageHTwips: 1800, marTopTwips: 200, marBottomTwips: 200 };
    const cell = (row: number, repeatHeader: boolean) => ({ tableId: 21, row, col: 0,
      colXTwips: 0, colWTwips: 2200, gridSpan: 1, firstInCell: true,
      firstInRow: true, lastInRow: true, shdFill: repeatHeader ? "DDDDDD" : null,
      tblStyleId: null, totalGridTwips: 2200, tblWVal: 2200, tblWType: "dxa",
      tblLayout: "fixed" as const, cantSplit: true, repeatHeader, bidiVisual: true,
      tblIndTwips: 0, tblJc: null, vMerge: null, vAlign: null,
      marTop: 0, marBottom: 0, marLeft: 0, marRight: 0,
      rowHeight: repeatHeader ? 300 : 700, rowHeightRule: "exact" as const,
      textDirection: null, tcBorders: { top: null, bottom: null, left: null, right: null } });
    const exact = { present: true, line: 240, lineRule: "exact" as const, before: 0, after: 0 };
    const doc = await buildScene(model([
      para("رأس الجدول", { spacing: exact, tableCell: cell(0, true) }),
      para("بيانات أولى", { spacing: exact, tableCell: cell(1, false) }),
      para("بيانات ثانية", { spacing: exact, tableCell: cell(2, false) }),
    ], section), provider());
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0]!.tables?.[0]?.rows.map(row => row.row)).toEqual([0, 1]);
    expect(doc.pages[1]!.tables?.[0]?.rows.map(row => row.row)).toEqual([0, 2]);
    expect(doc.pages[1]!.tables?.[0]?.rows[0]?.repeatHeader).toBe(true);
    expect(doc.pages[1]!.tables?.[0]?.rows[0]?.yTwips).toBe(section.marTopTwips);
    expect(doc.pages[1]!.tables?.[0]?.rows[1]?.yTwips).toBe(section.marTopTwips + 300);
  });
  it("يحاذي محتوى الخلية القصيرة في الوسط أو القاع داخل ارتفاع الصف", async () => {
    const cell = (col: number, vAlign: string | null) => ({ tableId: 22, row: 0, col,
      colXTwips: col * 800, colWTwips: 800, gridSpan: 1, firstInCell: true,
      firstInRow: col === 0, lastInRow: col === 1, shdFill: null, tblStyleId: null,
      totalGridTwips: 1600, tblWVal: 1600, tblWType: "dxa", tblLayout: "fixed" as const,
      cantSplit: false, repeatHeader: false, bidiVisual: true, tblIndTwips: 0,
      tblJc: null, vMerge: null, vAlign, marTop: 0, marBottom: 0, marLeft: 0,
      marRight: 0, rowHeight: null, rowHeightRule: "auto" as const, textDirection: null,
      tcBorders: { top: null, bottom: null, left: null, right: null } });
    const doc = await buildScene(model([
      para("كلمات كثيرة متتابعة تجعل الخلية الأولى أطول من الثانية بكثير", { tableCell: cell(0, null) }),
      para("قصير", { tableCell: cell(1, "bottom") }),
    ]), provider());
    const row = doc.pages[0]!.tables?.[0]?.rows[0]!;
    expect(row.cells[0]!.paragraphs[0]!.lines.length).toBeGreaterThan(1);
    expect(row.cells[1]!.paragraphs[0]!.yTwips).toBeGreaterThan(row.cells[0]!.paragraphs[0]!.yTwips);
    const shortBottom = row.cells[1]!.paragraphs[0]!.lines.at(-1)!.yTwips
      - row.cells[1]!.paragraphs[0]!.lines.at(-1)!.ascentTwips
      + row.cells[1]!.paragraphs[0]!.lines.at(-1)!.heightTwips;
    expect(shortBottom).toBeCloseTo(row.yTwips + row.hTwips, 4);
  });
  it("يرجع بحد جزء صف الجدول إلى بداية السطر العابر ولا يعلق في سطر أطول من الصفحة", () => {
    const line = (top: number, height: number) => ({ yTwips: 100 + top + 70, ascentTwips: 70,
      heightTwips: height, words: [] }) as never;
    const row = { tableId: 1, row: 0, yTwips: 100, hTwips: 1000, cantSplit: false,
      cells: [{ xTwips: 0, yTwips: 100, wTwips: 500, hTwips: 1000, gridSpan: 1,
        shdFill: null, borders: null, anchors: [], paragraphs: [{
          yTwips: 100, lines: [line(0, 200), line(300, 300), line(600, 200)],
        } as never] }],
    } as never;
    // السعة 450 تقطع السطر [300,600]؛ الحد الصحيح يرجع إلى 300.
    expect(tableRowFragmentHeight(row, 0, 450)).toBe(300);
    // عند بدء الجزء داخل سطر أطول من السعة، يتقدم الحارس بدل حلقة فارغة.
    expect(tableRowFragmentHeight(row, 300, 100)).toBe(100);
    expect(tableRowFragmentHeight(row, 800, 500)).toBe(200);
  });
  it("لا يترك سطرًا يتيمًا أسفل الصفحة أو أعلى التالية", () => {
    expect(widowOrphanLineFit(1, 4, false, true)).toBe(0);
    expect(widowOrphanLineFit(3, 4, false, true)).toBe(2);
    expect(widowOrphanLineFit(1, 4, false, false)).toBe(1);
    expect(widowOrphanLineFit(1, 4, true, true)).toBe(1);
  });
  it("ينقل keepNext مع السطر الأول التالي عندما تتسع الحزمة في صفحة فارغة", async () => {
    expect(keptParagraphNeedsFreshPage(1000, 2000, 700, 700, false, true)).toBe(true);
    const section = { ...SECTION, pageHTwips: 2400, marTopTwips: 500, marBottomTwips: 500 };
    const exact = { present: true, line: 300, lineRule: "exact" as const, before: 0, after: 0 };
    const doc = await buildScene(model([
      para("تمهيد", { spacing: { ...exact, after: 600 } }),
      para("عنوان", { spacing: exact, keepNext: true }),
      para("التالي", { spacing: exact }),
    ], section), provider());
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0]!.paragraphs).toHaveLength(1);
    expect(doc.pages[1]!.paragraphs).toHaveLength(2);
  });
  it("ينقل keepLines كاملة فقط إن كانت تتسع في صفحة فارغة", () => {
    expect(keptParagraphNeedsFreshPage(300, 1200, 900, 0, true, false)).toBe(true);
    expect(keptParagraphNeedsFreshPage(300, 800, 900, 0, true, false)).toBe(false);
    expect(keptParagraphNeedsFreshPage(300, 1200, 900, 0, false, false)).toBe(false);
  });
  it("يلغي before/after السياقيين كلًا من جهته بين فقرات النمط نفسه", async () => {
    const exact = { present: true, line: 300, lineRule: "exact" as const, before: 0, after: 0 };
    const doc = await buildScene(model([
      para("أ", { styleId: "ctx", contextualSpacing: true,
        spacing: { ...exact, after: 600 } }),
      para("ب", { styleId: "ctx", contextualSpacing: true,
        spacing: { ...exact, before: 400, after: 700 } }),
      para("ج", { styleId: "ctx", contextualSpacing: false,
        spacing: { ...exact, before: 300, after: 800 } }),
      para("د", { styleId: "other", contextualSpacing: true,
        spacing: { ...exact, before: 200 } }),
    ]), provider());
    const paras = doc.pages[0]!.paragraphs;
    const ys = paras.map(p => p.yTwips);
    const lineH = paras[0]!.lines[0]!.heightTwips;
    expect(ys[1]! - ys[0]!).toBeCloseTo(lineH, 6);
    expect(ys[2]! - ys[1]!).toBeCloseTo(lineH + 300, 6);
    expect(ys[3]! - ys[2]!).toBeCloseTo(lineH + 800, 6);
  });
  it("shapes the section header and footer into visible scene paragraphs", async () => {
    const header = para("عنوان الرأس");
    const footer = para("رقم التذييل");
    const section = {
      ...SECTION,
      headerRefs: { default: "header1.xml" },
      footerRefs: { default: "footer1.xml" },
      headerDistTwips: 500,
      footerDistTwips: 500,
    };
    const m = model([para("المتن")], section);
    m.headerFooters.set("header1.xml", [header]);
    m.headerFooters.set("footer1.xml", [footer]);

    const doc = await buildScene(m, provider());
    const pg = doc.pages[0]!;
    expect(pg.headerParas?.[0]?.lines[0]?.words.map((w) => w.text).join(" ")).toContain("عنوان");
    expect(pg.footerParas?.[0]?.lines[0]?.words.map((w) => w.text).join(" ")).toContain("رقم");
    expect(pg.headerParas![0]!.yTwips).toBe(500);
    expect(pg.footerParas![0]!.yTwips).toBeGreaterThan(SECTION.pageHTwips - 1000);
  });
  it("يختار قصة even أثناء التصفيح من رقم Word المعاد لا فهرس الورقة", async () => {
    const section = { ...SECTION, pgNumStart: 2,
      headerRefs: { default: "odd.xml", even: "even.xml" } };
    const m = model([para("المتن")], section);
    m.evenAndOddHeaders = true;
    m.headerFooters.set("odd.xml", [para("فردي")]);
    m.headerFooters.set("even.xml", [para("زوجي")]);
    const doc = await buildScene(m, provider());
    const words = doc.pages[0]!.headerParas?.flatMap(paragraph => paragraph.lines)
      .flatMap(line => line.words).map(word => word.text).join(" ");
    expect(words).toContain("زوجي");
    expect(words).not.toContain("فردي");
  });
  it("يفصل غلافًا يسبق كسر أول فقرة ولا يسقط default على first الفارغ", async () => {
    const section = { ...SECTION, titlePg: true,
      headerRefs: { default: "header.xml" }, footerRefs: { default: "footer.xml" } };
    const cover = { extentW: SECTION.pageWTwips, extentH: SECTION.pageHTwips,
      posHRel: "page", posHOffset: 0, posVRel: "page", posVOffset: 0,
      posHAlign: null, posVAlign: null, behindDoc: true, zOrder: -1,
      distL: 0, distR: 0, distT: 0, distB: 0, wrap: "", rId: null,
      vml: true, pageOffset: -1 } as BodyParagraph["anchors"][number];
    const p = para("المتن", { pageBreakBefore: true, pageBreaksBefore: 1, anchors: [cover] });
    const m = model([p], section);
    m.headerFooters.set("header.xml", [para("الرأس")]);
    m.headerFooters.set("footer.xml", [para("التذييل")]);
    const doc = await buildScene(m, provider());
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0]!.paragraphs).toHaveLength(0);
    expect(doc.pages[0]!.anchors).toHaveLength(1);
    expect(doc.pages[0]!.headerParas).toBeUndefined();
    expect(doc.pages[0]!.footerParas).toBeUndefined();
    expect(doc.pages[1]!.paragraphs).toHaveLength(1);
    expect(doc.pages[1]!.headerParas?.length).toBeGreaterThan(0);
    expect(doc.pages[1]!.footerParas?.length).toBeGreaterThan(0);
  });

  it("يوسع منطقة الرأس بصورة أمامية فقط ولا يجعل الخلفية/الغلاف يدفعان المتن", async () => {
    const foreground = { extentW: 600, extentH: 500, posHRel: "margin", posHOffset: 0,
      posVRel: "page", posVOffset: 1200, posHAlign: null, posVAlign: null,
      behindDoc: false, zOrder: 2, distL: 0, distR: 0, distT: 0, distB: 0,
      wrap: "None", rId: null, part: "header1.xml", inlineFlow: false } as never;
    const watermark = { ...foreground, extentH: 700, posVOffset: 2000, behindDoc: true } as never;
    const cover = { ...foreground, extentH: SECTION.pageHTwips, posVOffset: 0 } as never;
    const header = para("", { excluded: "drawing", anchors: [foreground, watermark, cover] });
    const section = { ...SECTION, headerRefs: { default: "header1.xml" } };
    const m = model([para("بداية المتن")], section);
    m.headerFooters.set("header1.xml", [header]);
    const doc = await buildScene(m, provider());
    const page = doc.pages[0]!;
    expect(headerBodyClearance(page, [header], section)).toBe(1700);
    expect(page.paragraphs[0]!.yTwips).toBe(1700);
    expect(page.paragraphs[0]!.lines[0]!.yTwips).toBeGreaterThan(1700);
  });

  it("يحجز التذييل المرتفع والرسم الأمامي من المتن ولا يحجز العلامة المائية", async () => {
    const section = { ...SECTION, pageHTwips: 2600, marTopTwips: 200, marBottomTwips: 200,
      footerDistTwips: 100, footerRefs: { default: "footer1.xml" } };
    const foreground = { extentW: 600, extentH: 260, posHRel: "margin", posHOffset: 0,
      posVRel: "page", posVOffset: 1900, posHAlign: null, posVAlign: null,
      behindDoc: false, zOrder: 2, distL: 0, distR: 0, distT: 0, distB: 0,
      wrap: "None", rId: null, part: "footer1.xml", inlineFlow: false } as never;
    const watermark = { ...foreground, extentH: 400, posVOffset: 1400, behindDoc: true } as never;
    const footer = para("السطر الأول من التذييل السطر الثاني", {
      spacing: { present: true, line: 420, lineRule: "exact", before: 0, after: 0 },
      anchors: [foreground, watermark],
    });
    const m = model([
      para("متن طويل يملأ الصفحة ".repeat(80), {
        spacing: { present: true, line: 300, lineRule: "exact", before: 0, after: 0 },
      }),
    ], section);
    m.headerFooters.set("footer1.xml", [footer]);
    const doc = await buildScene(m, provider());
    expect(doc.pages.length).toBeGreaterThan(1);
    for (const page of doc.pages) {
      const limit = footerBodyClearance(page, [footer], page.footerParas ?? [], section);
      const bodyBottoms = page.paragraphs.flatMap(paragraph => paragraph.lines)
        .map(line => line.yTwips - line.ascentTwips + line.heightTwips);
      expect(Math.max(...bodyBottoms)).toBeLessThanOrEqual(limit + 1);
      expect(limit).toBeLessThanOrEqual(1900);
    }
  });

  it("يحسب مرساة التذييل النسبية للفقرة من موضع التذييل لا من أعلى الصفحة", () => {
    const section = { ...SECTION, pageHTwips: 16838, marTopTwips: 2275,
      marBottomTwips: 2275, footerDistTwips: 1138 };
    const page = { index: 0, sectionIndex: 0, widthTwips: section.pageWTwips,
      heightTwips: section.pageHTwips, marLeftTwips: section.marLeftTwips,
      marRightTwips: section.marRightTwips, marTopTwips: section.marTopTwips,
      marBottomTwips: section.marBottomTwips, paragraphs: [], tables: [], anchors: [] } as never;
    const rule = { extentW: 7380, extentH: 1, posHRel: "margin", posHOffset: 0,
      posVRel: "paragraph", posVOffset: 2, posHAlign: null, posVAlign: null,
      behindDoc: false, zOrder: 1, distL: 0, distR: 0, distT: 0, distB: 0,
      wrap: "None", rId: null, part: "footer.xml", inlineFlow: false } as never;
    const limit = footerBodyClearance(page, [para("", { anchors: [rule] })], [], section);
    expect(limit).toBe(section.pageHTwips - section.marBottomTwips);
  });

  it("يكرر مرساة صورة الرأس ويحُل rId من علاقات الجزء المالك", async () => {
    const anchor = { extentW: 600, extentH: 300, posHRel: "margin", posHOffset: 120,
      posVRel: "page", posVOffset: 80, posHAlign: null, posVAlign: null,
      behindDoc: true, zOrder: 1, distL: 0, distR: 0, distT: 0, distB: 0,
      wrap: "none", rId: "rIdLogo", part: "header1.xml", inlineFlow: false,
      textBox: [para("نص الشعار")], boxIns: { l: 30, t: 20, r: 40, b: 20 },
      shape: { prst: "rect", fill: "EEEEEE", stroke: null, strokeW: 0, adj: null } } as never;
    const section = { ...SECTION, headerRefs: { default: "header1.xml" } };
    const m = model([para("الأولى"), para("الثانية", { pageBreaksBefore: 1 })], section);
    m.headerFooters.set("header1.xml", [para("", { excluded: "drawing", anchors: [anchor] })]);
    m.partRels.set("header1.xml", new Map([["rIdLogo", "media/logo.png"]]));
    m.mediaFiles.set("logo.png", new Uint8Array([1, 2, 3]));
    const doc = await buildScene(m, provider());
    expect(doc.pages).toHaveLength(2);
    for (const page of doc.pages) {
      expect(page.anchors).toHaveLength(1);
      expect(page.anchors[0]).toMatchObject({ xTwips: SECTION.marLeftTwips + 120,
        yTwips: 80, wTwips: 600, hTwips: 300, behindDoc: true });
      expect(page.anchors[0]!.imageData).toEqual(new Uint8Array([1, 2, 3]));
      expect(page.anchors[0]!.textBoxParas?.[0]?.lines[0]?.words.map(word => word.text).join(" "))
        .toContain("نص");
    }
  });

  it("يربط مرساة المتن بصفحة فقرتها بلا تكرار أو صفحة رسم وهمية", async () => {
    const floating = (y: number) => ({ extentW: 400, extentH: 200,
      posHRel: "page", posHOffset: 100, posVRel: "page", posVOffset: y,
      posHAlign: null, posVAlign: null, behindDoc: false, zOrder: 1,
      distL: 0, distR: 0, distT: 0, distB: 0, wrap: "None", rId: null,
      inlineFlow: false, shape: { prst: "rect", fill: "CCCCCC", stroke: null,
        strokeW: 0, adj: null } }) as never;
    const doc = await buildScene(model([
      para("متن الصفحة الأولى"),
      para("", { excluded: "drawing", anchors: [floating(200)] }),
      para("", { excluded: "drawing", pageBreaksBefore: 1, anchors: [floating(300)] }),
    ]), provider());
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages.map(page => page.anchors.length)).toEqual([1, 1]);
    expect(doc.pages[0]!.anchors[0]!.yTwips).toBe(200);
    expect(doc.pages[1]!.anchors[0]!.yTwips).toBe(300);
  });
  it("ينقل ظل وحد الصورة من imageEffects إلى مرساة الرسم", async () => {
    const source = para("صورة", { anchors: [{ extentW: 1000, extentH: 800,
      posHRel: "column", posHOffset: 0, posVRel: "paragraph", posVOffset: 0,
      posHAlign: null, posVAlign: null, behindDoc: false, zOrder: 1,
      distL: 0, distR: 0, distT: 0, distB: 0, wrap: "", rId: null,
      imageEffects: { shadow: { x: 2, y: 3, blur: 4, color: "112233", opacity: .5 },
        border: { width: 2, color: "445566" } } } as never] });
    const scene = await buildScene(model([source]), provider());
    expect(scene.pages[0]!.anchors[0]!.imageShadow)
      .toEqual({ x: 2, y: 3, blur: 4, color: "112233", opacity: .5 });
    expect(scene.pages[0]!.anchors[0]!.imageBorder)
      .toEqual({ width: 2, color: "445566" });
  });

  it("ينقل reflection من masjid وglow من tadris إلى scene", async () => {
    const reflected = masjidModel.paragraphs.find(paragraph => paragraph.anchors.some(anchor =>
      anchor.imageEffects?.reflection));
    const glowing = tadrisModel.paragraphs.find(paragraph => paragraph.anchors.some(anchor =>
      anchor.imageEffects?.glow));
    expect(reflected).toBeDefined(); expect(glowing).toBeDefined();
    const reflectedScene = await buildScene(model([{ ...reflected!, index: 0, sectionIndex: 0,
      excluded: "drawing" }]), provider());
    const glowingScene = await buildScene(model([{ ...glowing!, index: 0, sectionIndex: 0,
      excluded: "drawing" }]), provider());
    expect(reflectedScene.pages.flatMap(page => page.anchors).find(anchor => anchor.imageReflection)
      ?.imageReflection).toEqual({ distance: 0.5249343832020997, startOpacity: .38, endOpacity: 0 });
    expect(glowingScene.pages.flatMap(page => page.anchors).find(anchor => anchor.imageGlow)
      ?.imageGlow).toEqual({ radius: 14.666666666666666, color: "ED7D31", opacity: .4 });
  });

  it("ينقل أشكال SmartArt المحسوبة ونصوصها إلى أطفال المرساة", async () => {
    const source = para("", { excluded: "drawing", anchors: [{ extentW: 3000, extentH: 1800,
      posHRel: "column", posHOffset: 100, posVRel: "paragraph", posVOffset: 200,
      posHAlign: null, posVAlign: null, behindDoc: false, zOrder: 1,
      distL: 0, distR: 0, distT: 0, distB: 0, wrap: "TopAndBottom", rId: null,
      diagram: [{ x: 120, y: 80, w: 900, h: 500, prst: "ellipse",
        fill: "4472C4", text: "خطوة", em: 240 }] } as never] });
    const scene = await buildScene(model([source]), provider());
    expect(scene.pages[0]!.anchors[0]!.groupChildren).toEqual([{
      xTwips: SECTION.marLeftTwips + 100 + 120,
      yTwips: SECTION.marTopTwips + 200 + 80,
      wTwips: 900, hTwips: 500, imageData: null,
      shapeFill: "4472C4", shapeStroke: null, shapePrst: "ellipse",
      text: "خطوة", textEmTwips: 240,
    }]);
  });

  it.runIf(existsSync(OFFICEDEV_SAMPLE))("لا يسقط SmartArt في SampleDoc الرسمي من scene", async () => {
    const sample = extractFromDocx(readFileSync(OFFICEDEV_SAMPLE));
    const source = sample.paragraphs.find(paragraph => paragraph.anchors.some(anchor => anchor.diagram?.length));
    expect(source).toBeDefined();
    const scene = await buildScene(model([{ ...source!, index: 0, sectionIndex: 0,
      excluded: "drawing" }]), provider());
    const children = scene.pages.flatMap(page => page.anchors).flatMap(anchor => anchor.groupChildren ?? []);
    expect(children.length).toBeGreaterThan(1);
    expect(children.some(child => child.text?.trim())).toBe(true);
  });

  it.runIf(existsSync(OFFICEDEV_TEMPLATE))("يرسم Rectangle 78 وLOGO السطريين من عينة import-template", async () => {
    const sample = extractFromDocx(readFileSync(OFFICEDEV_TEMPLATE));
    const source = sample.paragraphs.find(paragraph => paragraph.anchors.some(anchor =>
      anchor.inlineFlow && anchor.textBox?.some(nested => nested.text === "LOGO")));
    expect(source).toBeDefined();
    const scene = await buildScene(model([{ ...source!, index: 0, sectionIndex: 0 }]), provider());
    const logo = scene.pages.flatMap(page => page.anchors)
      .find(anchor => anchor.shapePrst === "rect" && anchor.textBoxParas?.length);
    expect(logo).toMatchObject({ wTwips: 4202, hTwips: 647, shapeFill: null,
      shapeStrokeWTwips: 40 });
    const text = logo?.textBoxParas?.flatMap(paragraph => paragraph.lines)
      .flatMap(line => line.words).map(word => word.text).join(" ");
    expect(text).toContain("LOGO");
  });

  it.runIf(existsSync(OPENXML_THAI_PAGE))("يصوغ PAGE التايلندي في عينة Open XML SDK الرسمية", async () => {
    const sample = extractFromDocx(readFileSync(OPENXML_THAI_PAGE));
    expect(sample.section.pgNumFmt).toBe("thaiNumbers");
    const scene = await buildScene(sample, provider());
    // Word COM/PDF = ورقتان؛ scene بخط fallback تقدير ثلاث أوراق، ولا ندّعي
    // مساواة العدد. العقد هنا هو صياغة كل رقم ناتج بلا سقوط إلى ASCII.
    expect(scene.pages.length).toBeGreaterThanOrEqual(2);
    const footerText = scene.pages.map(page => page.footerParas?.flatMap(paragraph => paragraph.lines)
      .flatMap(line => line.words).map(word => word.text).join(" ").trim());
    expect(footerText).toEqual(scene.pages.map((_, index) => "๐๑๒๓๔๕๖๗๘๙"[index + 1]));
  });

  it.runIf(existsSync(OPENXML_BACKGROUND))("ينقل خلفية عينة Open XML SDK إلى صفحة scene", async () => {
    const sample = extractFromDocx(readFileSync(OPENXML_BACKGROUND));
    const scene = await buildScene(sample, provider());
    expect(scene.pages).toHaveLength(1);
    expect(scene.pages[0]).toMatchObject({ backgroundColor: "548DD4",
      pageBorderZOrder: "front" });
  });

  it.runIf(existsSync(OPENXML_SECTION_BREAK))("يحفظ حد الصفحة المخزن في العينة الرسمية ولا يضاعفه continuous", async () => {
    const sample = extractFromDocx(readFileSync(OPENXML_SECTION_BREAK));
    const scene = await buildScene(sample, provider());
    // Word repaginates this file to one page, while its OOXML still contains one
    // lastRenderedPageBreak. The deterministic renderer intentionally preserves it.
    expect(scene.pages).toHaveLength(2);
  });

  it.runIf(existsSync(OPENXML_TABLE_CELL_2_PARA))("يجمع فقرتي الخلية الرسمية داخل خلية scene واحدة", async () => {
    const scene = await buildScene(extractFromDocx(readFileSync(OPENXML_TABLE_CELL_2_PARA)), provider());
    expect(scene.pages).toHaveLength(1);
    const tables = scene.pages.flatMap(page => page.tables ?? []);
    expect(tables).toHaveLength(1);
    const firstCell = tables[0]!.rows[0]!.cells[0]!;
    expect(firstCell.paragraphs).toHaveLength(2);
    expect(firstCell.paragraphs.every(paragraph => paragraph.lines.length > 0)).toBe(true);
  });

  it.runIf(existsSync(OPENXML_COMPLEX_TABLE))("يركب سلسلة الجداول المتداخلة داخل خلايا scene بلا تدفق مكرر", async () => {
    const scene = await buildScene(extractFromDocx(readFileSync(OPENXML_COMPLEX_TABLE)), provider());
    expect(scene.pages).toHaveLength(1);
    expect(scene.pages[0]!.tables).toHaveLength(1);
    const flatten = (tables: NonNullable<(typeof scene.pages)[number]["tables"]>): typeof tables =>
      tables.flatMap(table => [table, ...table.rows.flatMap(row => row.cells.flatMap(cell =>
        flatten(cell.nestedTables ?? [])))]);
    const tables = new Map(flatten(scene.pages[0]!.tables!).map(table => [table.tableId, table]));
    expect(tables).toHaveLength(8);
    expect(tables.get(0)).toMatchObject({ nestingDepth: 0 });
    for (let id = 1; id < 8; id++) expect(tables.get(id)).toMatchObject({
      parentTableId: id - 1, parentRow: 0, parentCol: 0, nestingDepth: id,
    });
  });

  it.runIf(existsSync(OPENXML_HYPERLINK_TABLE))("يركب جدول HyperlinkInTable الرسمي داخل خلية الأب", async () => {
    const scene = await buildScene(extractFromDocx(readFileSync(OPENXML_HYPERLINK_TABLE)), provider());
    expect(scene.pages[0]!.tables).toHaveLength(1);
    const outer = scene.pages[0]!.tables![0]!;
    expect(outer.tableId).toBe(0);
    expect(outer.rows[0]!.cells[0]!.nestedTables).toHaveLength(1);
    expect(outer.rows[0]!.cells[0]!.nestedTables![0]).toMatchObject({
      tableId: 1, parentTableId: 0, parentRow: 0, parentCol: 0,
    });
  });

  it("يرصف text/table/text/table بحسب block index داخل خلية scene", async () => {
    const mixed = parseDocument(`<w:document xmlns:w="w"><w:body><w:tbl>
      <w:tblGrid><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc>
      <w:p><w:r><w:t>A</w:t></w:r></w:p>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>C</w:t></w:r></w:p>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>D</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>E</w:t></w:r></w:p>
      </w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const scene = await buildScene(mixed, provider());
    const cell = scene.pages[0]!.tables![0]!.rows[0]!.cells[0]!;
    const order = [
      ...cell.paragraphs.map(p => ({ y: p.yTwips, label: mixed.paragraphs.find(source => source.index === p.index)?.text })),
      ...(cell.nestedTables ?? []).map(t => ({ y: t.rows[0]!.yTwips, label: `T${t.tableId}` })),
    ].sort((a, b) => a.y - b.y).map(item => item.label);
    expect(order).toEqual(["A", "T1", "C", "T2", "E"]);
  });

  it("يحافظ على ترتيب SDT(table/text) بين فقرتي الخلية في scene", async () => {
    const mixed = parseDocument(`<w:document xmlns:w="w"><w:body><w:tbl>
      <w:tblGrid><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc>
      <w:p><w:r><w:t>A</w:t></w:r></w:p><w:sdt><w:sdtContent>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>C</w:t></w:r></w:p></w:sdtContent></w:sdt>
      <w:p><w:r><w:t>D</w:t></w:r></w:p>
      </w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const scene = await buildScene(mixed, provider());
    const cell = scene.pages[0]!.tables![0]!.rows[0]!.cells[0]!;
    const order = [
      ...cell.paragraphs.map(p => ({ y: p.yTwips, label: mixed.paragraphs.find(source => source.index === p.index)?.text })),
      ...(cell.nestedTables ?? []).map(t => ({ y: t.rows[0]!.yTwips, label: `T${t.tableId}` })),
    ].sort((a, b) => a.y - b.y).map(item => item.label);
    expect(order).toEqual(["A", "T1", "C", "D"]);
  });

  it.runIf(existsSync(OFFICEDEV_SAMPLE))("يحفظ تدرج وحد وظل شكل teardrop الرسمي", async () => {
    const sample = extractFromDocx(readFileSync(OFFICEDEV_SAMPLE));
    const source = sample.paragraphs.find(paragraph => paragraph.anchors.some(anchor =>
      anchor.shape?.prst === "teardrop"));
    expect(source).toBeDefined();
    const scene = await buildScene(model([{ ...source!, index: 0, sectionIndex: 0,
      excluded: "drawing" }]), provider());
    const shape = scene.pages.flatMap(page => page.anchors)
      .find(anchor => anchor.shapePrst === "teardrop");
    expect(shape).toMatchObject({ shapePrst: "teardrop", shapeStroke: "5B9BD5",
      shapeStrokeWTwips: 15, shapeAdj: 1.30918,
      imageShadow: { y: 2, blur: 6, color: "000000", opacity: .63 } });
    expect(shape?.shapeGradient?.stops).toEqual([
      { pos: 0, color: "FAFEFF" }, { pos: .5, color: "559BDB" },
      { pos: 1, color: "3D78AE" },
    ]);
  });

  it.runIf(existsSync(OFFICEDEV_SAMPLE))("ينقل chart الرسمي إلى مرساة المشهد دون سقوط", async () => {
    const sample = extractFromDocx(readFileSync(OFFICEDEV_SAMPLE));
    const source = sample.paragraphs.find(paragraph => paragraph.anchors.some(anchor => anchor.chart));
    expect(source).toBeDefined();
    const scene = await buildScene(model([{ ...source!, index: 0, sectionIndex: 0,
      excluded: "drawing" }]), provider());
    expect(scene.pages.flatMap(page => page.anchors).find(anchor => anchor.chart)?.chart)
      .toMatchObject({ kind: "bar", categories: ["Category 1", "Category 2"],
        series: [{ values: [4.3, 2.5] }, { values: [2.4, 4.4] }] });
  });

  it("يختار جهة Square wrap لكل wrapText ويمنع تقاطع السطر مع المرساة", async () => {
    expect(squareWrapTextRegion("left", "rtl", 100, 900, 350, 600)).toEqual({ left: 100, right: 350 });
    expect(squareWrapTextRegion("right", "ltr", 100, 900, 350, 600)).toEqual({ left: 600, right: 900 });
    expect(squareWrapTextRegion("largest", "rtl", 100, 900, 300, 500)).toEqual({ left: 500, right: 900 });
    expect(squareWrapTextRegion("bothSides", "ltr", 100, 900, 350, 600)).toEqual({ left: 100, right: 350 });
    expect(squareWrapTextRegion("bothSides", "rtl", 100, 900, 350, 600)).toEqual({ left: 600, right: 900 });

    const anchor = { extentW: 2000, extentH: 1200, posHRel: "column", posHOffset: 3000,
      posVRel: "paragraph", posVOffset: -300, posHAlign: null, posVAlign: null,
      behindDoc: false, zOrder: 1, distL: 100, distR: 100, distT: 0, distB: 0,
      wrap: "Square", wrapSide: "bothSides", rId: null, inlineFlow: false,
      shape: { prst: "rect", fill: "EEEEEE", stroke: null, strokeW: 0, adj: null } } as never;
    const doc = await buildScene(model([
      para("", { excluded: "drawing", anchors: [anchor] }),
      para("هذا نص يلتف إلى يمين المرساة ولا يتقاطع معها"),
    ]), provider());
    const line = doc.pages[0]!.paragraphs[0]!.lines[0]!;
    const exclusionRight = SECTION.marLeftTwips + 3000 + 2000 + 100;
    expect(line.startTwips - line.widthTwips).toBeGreaterThanOrEqual(exclusionRight - 1);
  });

  it("يضيّق استثناء Tight/Through بحسب wrapPolygon بدل مستطيل الصورة كله", async () => {
    const diamond = [{ x: 10800, y: 0 }, { x: 21600, y: 10800 },
      { x: 10800, y: 21600 }, { x: 0, y: 10800 }];
    expect(tightWrapHorizontalBounds(diamond, 100, 500, 200, 600, 300))
      .toEqual({ left: 200, right: 600 });
    expect(tightWrapHorizontalBounds(diamond, 100, 500, 200, 600, 200))
      .toEqual({ left: 300, right: 500 });

    const anchor = { extentW: 2000, extentH: 1200, posHRel: "column", posHOffset: 3000,
      posVRel: "paragraph", posVOffset: 0, posHAlign: null, posVAlign: null,
      behindDoc: false, zOrder: 1, distL: 100, distR: 100, distT: 0, distB: 0,
      wrap: "Tight", wrapSide: "bothSides", wrapPolygon: diamond, rId: null,
      inlineFlow: false, shape: { prst: "diamond", fill: "EEEEEE", stroke: null,
        strokeW: 0, adj: null } } as never;
    const doc = await buildScene(model([
      para("", { excluded: "drawing", anchors: [anchor] }),
      para("هذا نص يلتف حول الحد الحقيقي للشكل لا حول صندوق الصورة الكامل"),
    ]), provider());
    const line = doc.pages[0]!.paragraphs[0]!.lines[0]!;
    expect(line.startTwips - line.widthTwips)
      .toBeGreaterThan(SECTION.marLeftTwips + 3000 + 1000);
  });

  it("يطبق display/offsetFrom/zOrder لإطار الصفحة دون تغيير مساحة المتن", async () => {
    const side = { val: "single", wTwips: 30, spaceTwips: 40, color: "123456" };
    const section = { ...SECTION, pageBorders: { top: side, right: side, bottom: side, left: side },
      pageBorderOffsetFrom: "text" as const, pageBorderDisplay: "firstPage" as const,
      pageBorderZOrder: "back" as const };
    const doc = await buildScene(model([
      para("الأولى"), para("الثانية", { pageBreaksBefore: 1 }),
    ], section), provider());
    expect(doc.pages[0]!.pageBorders?.top).toEqual(side);
    expect(doc.pages[0]).toMatchObject({ pageBorderOffsetFrom: "text", pageBorderZOrder: "back" });
    expect(doc.pages[1]!.pageBorders).toBeUndefined();
    expect(doc.pages[0]!.paragraphs[0]!.widthTwips).toBe(SECTION.colWidthTwips);
  });

  it("builds one RTL page from a single paragraph", async () => {
    const doc = await buildScene(model([para("بسم الله الرحمن الرحيم")]), provider());
    expect(doc.pages.length).toBe(1);
    const pg = doc.pages[0]!;
    expect(pg.widthTwips).toBe(SECTION.pageWTwips);
    expect(pg.paragraphs.length).toBe(1);
    const par = pg.paragraphs[0]!;
    expect(par.dir).toBe("rtl");
    expect(par.lines.length).toBeGreaterThan(0);
    const words = par.lines[0]!.words;
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) {
      expect(w.glyphs.length).toBeGreaterThan(0);
      expect(w.advanceTwips).toBeGreaterThan(0);
    }
  });

  it("keeps line baselines inside the page and order is top-to-bottom", async () => {
    const doc = await buildScene(model([para("بسم الله الرحمن الرحيم")]), provider());
    const par = doc.pages[0]!.paragraphs[0]!;
    let prev = 0;
    for (const ln of par.lines) {
      expect(ln.yTwips).toBeGreaterThan(prev);
      expect(ln.yTwips + ln.descentTwips)
        .toBeLessThanOrEqual(doc.pages[0]!.heightTwips - doc.pages[0]!.marBottomTwips + 1);
      prev = ln.yTwips;
    }
  });

  it("RTL flow starts at the right margin of the column", async () => {
    const doc = await buildScene(model([para("كلمة")]), provider());
    const par = doc.pages[0]!.paragraphs[0]!;
    const line = par.lines[0]!;
    const rightEdge = SECTION.pageWTwips - SECTION.marRightTwips;
    // خط التدفّق يبدأ من حافة اليمين (الأولى في ترتيب التدفّق)
    expect(line.startTwips).toBeCloseTo(rightEdge, 0);
  });

  it("maps logical start/end to the physical edge for both directions", async () => {
    const rtlStart = (await buildScene(model([para("كلمة", { bidi: true, jc: "start" })]), provider()))
      .pages[0]!.paragraphs[0]!.lines[0]!;
    const rtlEnd = (await buildScene(model([para("كلمة", { bidi: true, jc: "end" })]), provider()))
      .pages[0]!.paragraphs[0]!.lines[0]!;
    const ltrStart = (await buildScene(model([para("word", { bidi: false, jc: "start" })]), provider()))
      .pages[0]!.paragraphs[0]!.lines[0]!;
    const ltrEnd = (await buildScene(model([para("word", { bidi: false, jc: "end" })]), provider()))
      .pages[0]!.paragraphs[0]!.lines[0]!;
    const left = SECTION.marLeftTwips;
    const right = SECTION.pageWTwips - SECTION.marRightTwips;

    expect(rtlStart.startTwips).toBeCloseTo(right, 0);
    expect(rtlEnd.startTwips - rtlEnd.widthTwips).toBeCloseTo(left, 0);
    expect(ltrStart.startTwips).toBeCloseTo(left, 0);
    expect(ltrEnd.startTwips + ltrEnd.widthTwips).toBeCloseTo(right, 0);
  });

  it("breaks a long paragraph into multiple lines inside a narrow column", async () => {
    const narrow = { ...SECTION, columnTwips: 2600, colWidthTwips: 2600 };
    const text = "بسم الله الرحمن الرحيم والصلاة والسلام على رسول الله وعلى آله وصحبه أجمعين، أما بعد فإن خير الكلام كلام الله وخير الهدي هدي محمد صلى الله عليه وسلم";
    const doc = await buildScene(model([para(text, { jc: "right" })], narrow), provider());
    const par = doc.pages[0]!.paragraphs[0]!;
    expect(par.lines.length).toBeGreaterThan(3);
    for (const ln of par.lines) {
      // الحافة اليمنى (بداية التدفّق لـRTL) عند الهامش الأيمن
      expect(ln.startTwips).toBeLessThanOrEqual(SECTION.pageWTwips - SECTION.marRightTwips + 1);
      // الحافة اليسرى ضمن الهامش الأيسر (مع تسامح تدلّي الترقيم الطرفيّ)
      expect(ln.startTwips - ln.widthTwips).toBeGreaterThanOrEqual(SECTION.marLeftTwips - 13);
    }
  });

  it("splits overflowing paragraphs across pages", async () => {
    const tiny = {
      ...SECTION, pageHTwips: 2500, marTopTwips: 150, marBottomTwips: 150,
      columnTwips: 2600, colWidthTwips: 2600,
    };
    const text = "بسم الله الرحمن الرحيم والصلاة والسلام على رسول الله وعلى آله وصحبه أجمعين، أما بعد فإن خير الكلام كلام الله وخير الهدي هدي محمد صلى الله عليه وسلم";
    const doc = await buildScene(model([para(text, { jc: "right" })], tiny), provider());
    expect(doc.pages.length).toBeGreaterThan(1);
    // لا سطرٍ يتجاوز أسفل الصفحة
    for (const pg of doc.pages) {
      for (const par of pg.paragraphs) {
        for (const ln of par.lines) {
          expect(ln.yTwips + ln.descentTwips)
            .toBeLessThanOrEqual(pg.heightTwips - pg.marBottomTwips + 1);
        }
      }
    }
  });

  it("justified (both) lines fill the column width", async () => {
    const narrow = { ...SECTION, columnTwips: 2600, colWidthTwips: 2600 };
    const text = "بسم الله الرحمن الرحيم والصلاة والسلام على رسول الله وعلى آله وصحبه أجمعين أما بعد فإن خير الكلام كلام الله";
    const doc = await buildScene(model([para(text, { jc: "both" })], narrow), provider());
    const par = doc.pages[0]!.paragraphs[0]!;
    const avail = par.widthTwips;
    const justified = par.lines.filter((l) => l.justified);
    expect(justified.length).toBeGreaterThan(0);
    for (const ln of justified) {
      expect(Math.abs(ln.widthTwips - avail)).toBeLessThan(2);
    }
  });

  it("deduplicates fonts by family+bold+italic", async () => {
    const two = model([
      para("بسم الله", {}),
      para("الرحمن الرحيم", {}),
    ]);
    const doc = await buildScene(two, provider());
    expect(doc.fonts.length).toBe(1);
  });
});

describe("scene build — sample-ahadith (real docx)", () => {
  it("extracts a model with body paragraphs and builds pages", async () => {
    expect(ahadithModel.paragraphs.length).toBeGreaterThan(0);
    const doc = await buildScene(ahadithModel, provider());
    expect(doc.pages.length).toBeGreaterThan(0);
    const pg = doc.pages[0]!;
    expect(pg.paragraphs.length).toBeGreaterThan(0);
    // كل الكلمات المُرسمة لها غليفات
    for (const par of pg.paragraphs) {
      for (const ln of par.lines) {
        for (const w of ln.words) expect(w.glyphs.length).toBeGreaterThan(0);
      }
    }
  });

  it("respects page bounds across all pages", async () => {
    const doc = await buildScene(ahadithModel, provider());
    for (const pg of doc.pages) {
      for (const par of pg.paragraphs) {
        for (const ln of par.lines) {
          expect(ln.yTwips + ln.descentTwips)
            .toBeLessThanOrEqual(pg.heightTwips - pg.marBottomTwips + 1);
        }
      }
    }
  });
});

describe("scene build — header anchors corpus", () => {
  it("يبدّل تذييل sample-tadris بين even/default بعد صفحة العنوان", async () => {
    expect(tadrisModel.evenAndOddHeaders).toBe(true);
    expect(tadrisModel.section.titlePg).toBe(true);
    expect(tadrisModel.section.footerRefs).toMatchObject({
      even: "footer1.xml", default: "footer2.xml",
    });
    const doc = await buildScene(tadrisModel, provider(), { maxPages: 3 });
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0]!.anchors.filter(anchor => anchor.wTwips === 807)).toHaveLength(0);
    // إحداثيات VML تُقاس من بداية العمود المنطقية: even إلى يمين RTL،
    // وdefault إلى اليسار.
    expect(doc.pages[1]!.anchors.find(anchor => anchor.wTwips === 807)?.xTwips).toBeGreaterThan(8000);
    expect(doc.pages[2]!.anchors.find(anchor => anchor.wTwips === 807)?.xTwips).toBeLessThan(1000);
  });
  it("يحفظ شفافية خلفية header1 في sample-masjid عند 5%", async () => {
    const source = [...masjidModel.headerFooters.values()].flatMap(paragraphs => paragraphs)
      .flatMap(paragraph => paragraph.anchors ?? []).find(anchor => anchor.imageEffects?.opacity != null);
    expect(source?.part).toBe("header1.xml");
    expect(source?.imageEffects?.opacity).toBe(.05);
    // صفحة العنوان في الأصل بلا default header؛ ثبّت قصة corpus نفسها على
    // مقطع صفحة واحدة كي يختبر التحويل لا وصول المصفي إلى الصفحة التالية.
    const section = { ...masjidModel.section, titlePg: false,
      headerRefs: { default: "header1.xml" } };
    const forced = { ...masjidModel, section, sections: [section],
      paragraphs: masjidModel.paragraphs.map(paragraph => ({ ...paragraph, sectionIndex: 0 })) };
    const doc = await buildScene(forced, provider(), { maxPages: 1 });
    const background = doc.pages.flatMap(page => page.anchors)
      .find(anchor => anchor.imageOpacity != null);
    expect(background).toMatchObject({ behindDoc: true, imageOpacity: .05 });
    expect(background?.imageData?.length).toBeGreaterThan(0);
  });
  it("يحفظ مرساتي رأس sample-muqtarah ويخرجهما في صفحات المشهد", async () => {
    const owned = [...muqtarahModel.headerFooters.values()]
      .flatMap(paragraphs => paragraphs).flatMap(paragraph => paragraph.anchors ?? [])
      .filter(anchor => anchor.part?.startsWith("header"));
    expect(owned).toHaveLength(2);
    const doc = await buildScene(muqtarahModel, provider(), { maxPages: 1 });
    expect(doc.pages.some(page => page.anchors.some(anchor => anchor.imageData != null || anchor.shapePrst != null)))
      .toBe(true);
  });
  it("يرصف مربعات نص رأس sample-tadris داخل مراسيها", async () => {
    const boxes = [...tadrisModel.headerFooters.values()].flatMap(paragraphs => paragraphs)
      .flatMap(paragraph => paragraph.anchors ?? []).filter(anchor => anchor.textBox?.length);
    expect(boxes).toHaveLength(2);
    expect(boxes.flatMap(anchor => anchor.textBox ?? []).some(paragraph => paragraph.text.trim().length > 0))
      .toBe(true);
  });
  it("يرصف مربعات نص متن sample-tadris في مرساة المشهد", async () => {
    const boxes = tadrisModel.paragraphs.flatMap(paragraph => paragraph.anchors ?? [])
      .filter(anchor => !anchor.inlineFlow && anchor.textBox?.length);
    expect(boxes).toHaveLength(5);
    const doc = await buildScene(tadrisModel, provider(), { maxPages: 1 });
    expect(doc.pages.flatMap(page => page.anchors).some(anchor =>
      anchor.textBoxParas?.some(paragraph => paragraph.lines.length > 0))).toBe(true);
  });
  it("يحفظ bothSides لكل حالات wrapSquare في كتب corpus الثلاثة", () => {
    const sides = (m: DocumentModelV0) => m.paragraphs.flatMap(paragraph => paragraph.anchors ?? [])
      .filter(anchor => anchor.wrap === "Square").map(anchor => anchor.wrapSide);
    expect(sides(tadrisModel)).toEqual(["bothSides", "bothSides", "bothSides"]);
    expect(sides(masjidModel)).toEqual(["bothSides", "bothSides"]);
    expect(sides(muqtarahModel)).toEqual(["bothSides"]);
  });
  it("يحفظ إطاري الصفحة المثبتين في tadris وjalsa27", () => {
    expect(tadrisModel.sections.filter(section => section.pageBorders).length).toBe(1);
    expect(jalsaModel.sections.filter(section => section.pageBorders).length).toBe(1);
    for (const section of [...tadrisModel.sections, ...jalsaModel.sections].filter(s => s.pageBorders)) {
      expect(section.pageBorders?.top ?? section.pageBorders?.bottom
        ?? section.pageBorders?.left ?? section.pageBorders?.right).not.toBeNull();
    }
  });
  it("يحفظ ترتيب أطفال مجموعة VML في تذييل jalsa27 ونص طبقتها العليا", async () => {
    const source = [...jalsaModel.headerFooters.values()].flatMap(paragraphs => paragraphs)
      .flatMap(paragraph => paragraph.anchors ?? []).filter(anchor => anchor.vml);
    expect(source).toHaveLength(3);
    expect(new Set(source.map(anchor => `${anchor.posHOffset}:${anchor.posVOffset}:${anchor.extentW}:${anchor.extentH}`)).size)
      .toBe(1);
    expect(source[2]!.textBox?.map(paragraph => paragraph.text).join(" ")).toContain("26");
    const section = { ...jalsaModel.section, titlePg: false,
      footerRefs: { default: "footer1.xml" } };
    const forced = { ...jalsaModel, section, sections: [section],
      paragraphs: jalsaModel.paragraphs.map(paragraph => ({ ...paragraph, sectionIndex: 0 })) };
    const doc = await buildScene(forced, provider(), { maxPages: 1 });
    for (const page of doc.pages) {
      const layered = page.anchors
        .filter(anchor => anchor.wTwips === 525 && anchor.hTwips === 720);
      expect(layered).toHaveLength(3);
      expect(layered.map(anchor => anchor.zOrder)).toEqual([
        source[0]!.zOrder, source[1]!.zOrder, source[2]!.zOrder,
      ]);
      if (page.index === 0) expect(layered.map(anchor => anchor.textBoxParas?.flatMap(paragraph => paragraph.lines)
        .flatMap(line => line.words).map(word => word.text).join(" ") ?? "")).toContain("26");
    }
  });
});
