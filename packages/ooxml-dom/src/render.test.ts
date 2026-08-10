/** اختبار المُركِّب على عينةٍ حقيقية (corpus) مع DOM محاكٍّ خفيف.
 *  الهدف: إثبات أن renderDocument يقسّم الصفحات ويرسم الفقرات والجداول
 *  والترويسات/التذييلات والحواشي دون كسر. */

import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { extractFromDocx, parseDocument, parseStyles } from "@engine/ooxml-model";
import { setDocumentFactory } from "./dom.js";
import { buildPageElement, coverAnchorForPage, documentPageNumbers, fillPageWithCover, footnotesBlock, groupPages, headerFooterAnchorReservesSpace, nextDocumentPageNumber, noteBodyNeedsMarker, notePositionForPage, noteSeparatorParagraphs, pageCountsBySection, paragraphAnchorTop, positionFloatingAnchor, renumberNoteRefsForPages, renderDocument, replacePageFieldText, storyClearancePx, styleRefValuesForPage, takeRenderedAssetCleanup } from "./render.js";
import { framePrCss, headerFooterElement, headerFooterPartName, headerFooterType, pageBorderElement, pageNumberText } from "./SectPr.js";
import { anchorToElement, anchorTransformCss, rasterPayload, shapeFrameCss } from "./ImageToWidget.js";
import { newRenderCtx, numberMarkerFontCss, numberMarkerLookCss, paragraphOutlineAttrs, paragraphToElement } from "./Paragraph.js";
import { formatNumber } from "./abstractNum.js";
import { runCss, runToNode, textReflectionCss, wordFontKerning } from "./runT.js";
import { paragraphCss, wordJustification } from "./PPr.js";
import { columnFragments, renderPageBlocks, rowHeightCss } from "./ParagraphTable.js";
import { groupTable, tableWidthTwips, withRepeatedHeaderRows } from "./ParagraphTable.js";
import { wordBorderStyle } from "./BorderCss.js";

const TAWHID = new URL("../../../../../كتب للاختبار/توحيد الحاكمية.docx", import.meta.url);
const MINHAJ_CAMP = new URL("../../../../../كتب للاختبار/منهاج مخيم جيل العزة - المخيم الصيفي لمدة أسبوع.docx", import.meta.url);
const FOOTNOTE_TABLE_BOOK = new URL("../../../../../كتب للاختبار/الشامل في المسائل للمفتي والنوازل3.. الجهاد، وقتال أهل البغي، وأحكام أهل الذمة، والحسبة، والسياسة.docx", import.meta.url);
const POETRY = new URL("../../../../../كتب للاختبار/همومٌ وآلام.. ديوان شعري.docx", import.meta.url);
const ZAAD = new URL("../../../../../كتب للاختبار/زادُ المجاهد2.. النبي القائد ﷺ، مبحث في سرايا النبي وغزواته وما يسره ربنا من الفوائد والعبر.docx", import.meta.url);
const TADRIS_ART_BORDER = new URL("../../../corpus/books/sample-tadris.docx", import.meta.url);
const OPENXML_COMPLEX_TABLE = new URL("../../../tmp/Word external QA/OpenXmlSdk-ComplexTable/complex-table.docx", import.meta.url);
const IBHAJ_SANITIZED = new URL("../../../docs/qa/publish-sanitized-staging/إبهاج أهل الصناعة بدراسة حديث بعثت بالسيف بين يدي الساعة - أبو ذر السمهري اليماني.docx", import.meta.url);
const USUS_NOTES = new URL("../../../../../كتب للاختبار/أُسس قوام الشخصية الفاعلة.. شرح سورة الشرح.docx", import.meta.url);
const OPENXML_GREETING_LINE = new URL("../../../tmp/Word external QA/OpenXmlSdk-GreetingLine/greeting-line.docx", import.meta.url);
const OPENXML_TABLE_CELL_2_PARA = new URL("../../../tmp/Word external QA/OpenXmlSdk-TableCell2Para/table-cell-2-para.docx", import.meta.url);
const OPENXML_HYPERLINK_TABLE = new URL("../../../tmp/Word external QA/OpenXmlSdk-HyperlinkInTable/hyperlink-in-table.docx", import.meta.url);

describe("إطار twistedLines1 الفني", () => {
  it.runIf(existsSync(TADRIS_ART_BORDER))("يحفظ النمط وزواياه الأربع من corpus بدل solid", () => {
    const model = extractFromDocx(readFileSync(TADRIS_ART_BORDER));
    expect(model.section.pageBorders?.top?.val).toBe("twistedLines1");
    const frame = pageBorderElement(model.section, 0) as unknown as FakeNode;
    expect(frame.dataset.wordArtBorder).toBe("twistedLines1");
    expect(frame.children).toHaveLength(4);
    expect(frame.children.map(child => child.attrs.get("class"))).toEqual([
      "page-border-knot page-border-knot--tl", "page-border-knot page-border-knot--tr",
      "page-border-knot page-border-knot--bl", "page-border-knot page-border-knot--br",
    ]);
  });
});
const TAWHID_WORD_STARTS = [0, 1, 2, 8, 18, 24, 28, 32, 42, 49, 56, 60, 63, 68, 73, 77,
  80, 85, 91, 96, 99, 107, 113, 118, 125, 127, 131, 144, 155, 162, 167, 175];
const MINHAJ_WORD_MODEL_STARTS = [0, 10, 25, 43, 52, 64, 69, 94, 126, 129, 145, 161, 176, 188,
  195, 209, 218, 234, 248, 253, 267, 271, 287, 300, 312, 327, 330, 348, 370, 390, 418, 441,
  468, 473, 485, 499, 511, 515, 530, 535, 547];

function groupsAt(model: ReturnType<typeof extractFromDocx>, starts: number[]): typeof model.paragraphs[] {
  return starts.map((start, index) => model.paragraphs.slice(start, starts[index + 1] ?? model.paragraphs.length));
}

function descendants(node: FakeNode, tag: string): FakeNode[] {
  return [...(node.tag === tag ? [node] : []), ...node.children.flatMap(child => descendants(child, tag))];
}

/** DOM محاكٍّ أدنى لاختبار البناء (لا حاجة لـjsdom). */
class FakeNode {
  children: FakeNode[] = [];
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  _text = "";
  constructor(public readonly tag: string) {}
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
    if (k.startsWith("data-")) {
      const key = k.slice(5).replace(/-([a-z])/g, (_all, letter: string) => letter.toUpperCase());
      this.dataset[key] = v;
    }
  }
  get textContent(): string {
    if (this._text) return this._text;
    return this.children.map((c) => c.textContent).join("");
  }
  appendChild(c: FakeNode): FakeNode { this.children.push(c); return c; }
}
class FakeDocument {
  createElement(tag: string): FakeNode { return new FakeNode(tag); }
  createTextNode(text: string): FakeNode { const n = new FakeNode("#text"); n._text = text; return n; }
}

setDocumentFactory(() => new FakeDocument() as unknown as Document);

describe("Open XML SDK — nested table DOM tree", () => {
  it.runIf(existsSync(OPENXML_HYPERLINK_TABLE))("يركب جدول HyperlinkInTable الرسمي داخل td الأب", () => {
    const model = extractFromDocx(readFileSync(OPENXML_HYPERLINK_TABLE));
    const blocks = renderPageBlocks(model.paragraphs, model.section, newRenderCtx(model)) as unknown as FakeNode[];
    const roots = blocks.filter(block => block.tag === "table");
    expect(roots).toHaveLength(1);
    const tables = descendants(roots[0]!, "table");
    expect(tables).toHaveLength(2);
    expect(tables.map(table => table.dataset.wordTableId)).toEqual(["0", "1"]);
    expect(tables[1]!.dataset.wordParentTable).toBe("0");
    expect(descendants(roots[0]!, "a").some(anchor => anchor.textContent.includes("ecma"))).toBe(true);
  });

  it.runIf(existsSync(OPENXML_COMPLEX_TABLE))("يركب الجداول الثمانية داخل خلايا آبائها بلا أشقاء مكررين", () => {
    const model = extractFromDocx(readFileSync(OPENXML_COMPLEX_TABLE));
    const blocks = renderPageBlocks(model.paragraphs, model.section, newRenderCtx(model)) as unknown as FakeNode[];
    const roots = blocks.filter(block => block.tag === "table");
    expect(roots).toHaveLength(1);
    const tables = descendants(roots[0]!, "table");
    expect(tables).toHaveLength(8);
    expect(tables.map(table => table.dataset.wordTableId)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
    for (let id = 1; id < 8; id++) {
      expect(tables[id]!.dataset.wordParentTable).toBe(String(id - 1));
      expect(descendants(tables[id - 1]!, "table")).toContain(tables[id]);
    }
  });

  it("يركب text/table/text/table بترتيب OOXML داخل td", () => {
    const source = parseDocument(`<w:document xmlns:w="w"><w:body><w:tbl>
      <w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc>
      <w:p><w:r><w:t>A</w:t></w:r></w:p>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>C</w:t></w:r></w:p>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>D</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>E</w:t></w:r></w:p>
      </w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const root = renderPageBlocks(source.paragraphs, source.section, newRenderCtx(source))[0] as unknown as FakeNode;
    const td = descendants(root, "td")[0]!;
    expect(td.children.map(child => child.tag)).toEqual(["div", "table", "div", "table", "div"]);
    expect(td.children.map(child => child.textContent)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("لا يعيد sdtContent عداد كتل td إلى الصفر", () => {
    const source = parseDocument(`<w:document xmlns:w="w"><w:body><w:tbl>
      <w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc>
      <w:p><w:r><w:t>A</w:t></w:r></w:p><w:sdt><w:sdtContent>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>C</w:t></w:r></w:p></w:sdtContent></w:sdt>
      <w:p><w:r><w:t>D</w:t></w:r></w:p>
      </w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const root = renderPageBlocks(source.paragraphs, source.section, newRenderCtx(source))[0] as unknown as FakeNode;
    const td = descendants(root, "td")[0]!;
    expect(td.children.map(child => child.textContent)).toEqual(["A", "B", "C", "D"]);
  });
});

describe("اتصال العربية عبر حدود runs", () => {
  it("يطبق docGrid على auto وatLeast دون exact ويحترم snapToGrid=0", () => {
    const section = { docGridLinePitch: 360, docGridType: "lines" } as Parameters<typeof paragraphCss>[1];
    const paragraph = { bidi: true, jc: "right", spacing: { line: 240, lineRule: "auto" },
      runs: [{ text: "سطر", emTwips: 200 }], markEmTwips: null, snapToGrid: true,
      tabStops: [] } as unknown as Parameters<typeof paragraphCss>[0];
    expect(paragraphCss(paragraph, section)).toContain("line-height:24px");
    expect(paragraphCss({ ...paragraph, runs: [{ text: "كبير", emTwips: 600 }] }, section))
      .toContain("line-height:48px");
    expect(paragraphCss({ ...paragraph, spacing: { line: 300, lineRule: "atLeast" } }, section))
      .toContain("line-height:24px");
    expect(paragraphCss({ ...paragraph, spacing: { line: 300, lineRule: "exact" } }, section))
      .toContain("line-height:20px");
    expect(paragraphCss({ ...paragraph, snapToGrid: false }, section)).toContain("line-height:1");
  });

  it("يحوّل outline 0..8 إلى heading ويترك level 9 متنًا", () => {
    expect(paragraphOutlineAttrs({ outlineLevel: 2 } as Parameters<typeof paragraphOutlineAttrs>[0]))
      .toEqual({ role: "heading", "aria-level": "3", "data-outline-level": "2" });
    expect(paragraphOutlineAttrs({ outlineLevel: 9 } as Parameters<typeof paragraphOutlineAttrs>[0])).toEqual({});
  });
  it("يرسم علامة القائمة بخط numbering الصريح", () => {
    expect(numberMarkerFontCss({ markAsciiFamily: "Wingdings" } as Parameters<typeof numberMarkerFontCss>[0]))
      .toContain("font-family:'Wingdings'");
  });
  it("يرسم مظهر علامة القائمة مستقلًا عن متن الفقرة", () => {
    const p = { numId: "7", ilvl: "0" } as Parameters<typeof numberMarkerLookCss>[0];
    const model = { numbering: new Map([["7/0", { markerBold: true, markerUnderline: "single", markerColor: "0000FF" }]]) } as unknown as Parameters<typeof numberMarkerLookCss>[1];
    const style = numberMarkerLookCss(p, model);
    expect(style).toContain("font-weight:700");
    expect(style).toContain("text-decoration-line:underline");
    expect(style).toContain("color:#0000FF");
  });
  it("يعطل الفصل الآلي للفقرة عند طلب Word", () => {
    const p = { bidi: false, jc: "left", spacing: {}, runs: [], tabStops: [],
      suppressAutoHyphens: true } as Parameters<typeof paragraphCss>[0];
    expect(paragraphCss(p)).toContain("hyphens:none");
  });
  it("يفعل w:kern عند بلوغ حد الحجم ويعطله دونه", () => {
    const base = { text: "AV", hidden: false, family: "Times New Roman", kern: 24 };
    expect(wordFontKerning({ ...base, emTwips: 240 })).toBe("normal");
    expect(wordFontKerning({ ...base, emTwips: 230 })).toBe("none");
    expect(runCss({ ...base, emTwips: 240 })).toContain("font-kerning:normal");
    expect(runCss({ ...base, emTwips: 230 })).toContain("font-kerning:none");
  });

  it("ينقل w:w إلى font-stretch بالنسبة المصرح بها", () => {
    const run = { text: "عنوان", hidden: false, family: "Arial", emTwips: 240, charScale: 36 };
    expect(runCss(run)).toContain("font-stretch:36%");
    expect(runCss({ ...run, charScale: 100 })).not.toContain("font-stretch");
  });

  it("يفعل ligatures القياسية والسياقية المطلوبة من Word", () => {
    const run = { direction: "ltr", text: "office", family: null, emTwips: 240, hidden: false,
      ligatures: "standardContextual" } as Parameters<typeof runCss>[0];
    expect(runCss(run)).toContain("font-variant-ligatures:common-ligatures contextual");
  });

  it("يضع لغة bidi على الرن العربي ولغة val على الرن اللاتيني", () => {
    const base = { text: "نص", hidden: false, family: "Arial", emTwips: 240,
      language: "en-US", bidiLanguage: "ar-SY" } as Parameters<typeof runToNode>[0];
    const rtl = runToNode({ ...base, direction: "rtl" }) as unknown as FakeNode;
    const ltr = runToNode({ ...base, direction: "ltr" }) as unknown as FakeNode;
    expect(rtl.attrs.get("lang")).toBe("ar-SY");
    expect(ltr.attrs.get("lang")).toBe("en-US");
  });

  it("يقص تدرج w14:textFill داخل الغليفات لا خلف الرن", () => {
    const run = { text: "عنوان", hidden: false, family: "Arial", emTwips: 240,
      textGradient: { angle: 90, stops: [{ pos: 0, color: "800000" }, { pos: 1, color: "FFFFFF" }] } };
    const style = runCss(run);
    expect(style).toContain("background:linear-gradient(90deg,#800000 0%,#FFFFFF 100%)");
    expect(style).toContain("background-clip:text");
    expect(style).toContain("color:transparent");
  });

  it("يرسم w14:textOutline حول الغليفات بالعرض واللون المحلولين", () => {
    const run = { text: "عنوان", hidden: false, family: "Arial", emTwips: 240,
      textOutline: { widthTwips: 15, color: "800000" } };
    const style = runCss(run);
    expect(style).toContain("-webkit-text-stroke:1px #800000");
    expect(style).toContain("paint-order:stroke fill");
  });
  it("يرسم w14:shadow بإزاحته وتمويهه وعتامته", () => {
    const run = { direction: "rtl", text: "مظلل", family: null, emTwips: 240, hidden: false,
      textShadow: { xTwips: 15, yTwips: 0, blurTwips: 30, color: "800000", opacity: 0.35 } } as Parameters<typeof runCss>[0];
    expect(runCss(run)).toContain("text-shadow:1px 0px 2px rgba(128,0,0,0.35)");
  });
  it("يرسم w14:reflection كطبقة مطلقة ممسوحة ولا يكرر النص القابل للنسخ", () => {
    const run = { direction: "rtl", text: "منعكس", family: "Arial", emTwips: 320, hidden: false,
      textReflection: { xTwips: 0, yTwips: 1003 / 635, blurTwips: 20,
        scaleX: 1, scaleY: -1, startOpacity: .28, endOpacity: 0,
        startPosition: 0, endPosition: .45, fadeAngle: 180 } } as Parameters<typeof runToNode>[0];
    const style = textReflectionCss(run)!;
    expect(style).toContain("position:absolute");
    expect(style).toContain("transform:scale(1,-1)");
    expect(style).toContain("filter:blur(1.333px)");
    expect(style).toContain("rgba(0,0,0,0.28) 0%");
    expect(style).toContain("rgba(0,0,0,0) 45%");
    const node = runToNode(run) as unknown as FakeNode;
    expect(node.textContent).toBe("منعكس");
    const copy = descendants(node, "span").find(child => child.attrs.get("class") === "run-reflection");
    expect(copy?.attrs.get("aria-hidden")).toBe("true");
    expect(copy?.attrs.get("data-reflection-text")).toBe("منعكس");
  });
  it("لا يعزل الرن العربي فيفصل حرفًا عن بقية الكلمة", () => {
    const css = runCss({ direction: "rtl" } as Parameters<typeof runCss>[0]);
    expect(css).not.toContain("unicode-bidi:isolate");
    expect(runCss({ direction: "ltr" } as Parameters<typeof runCss>[0])).toContain("unicode-bidi:isolate");
  });

  it("يحفظ الكشيدة الحرفية في نص العرض دون تطبيع", () => {
    const source = "الرَّحـمٰن";
    const node = runToNode({ text: source } as Parameters<typeof runToNode>[0]) as unknown as FakeNode;
    expect(node.textContent).toBe(source);
    expect(node.textContent).toContain("\u0640");
  });

  it("يعرض علامة الحاشية المخصصة نفسها بدل رقم آلي", () => {
    const node = runToNode({ text: "(أ)", noteRef: {
      id: "7", num: 0, kind: "footnote", custom: true, customMark: "(أ)",
    } } as Parameters<typeof runToNode>[0]) as unknown as FakeNode;
    expect(node.textContent.trim()).toBe("(أ)");
    expect(node.textContent).not.toContain("0");
  });

  it("يعرض الأقواس المعقوفة العربية بجهة الفتح المطابقة لـWord", () => {
    const node = runToNode({ text: "{ آية }", direction: "rtl" } as Parameters<typeof runToNode>[0]) as unknown as FakeNode;
    expect(node.textContent).toBe("} آية {");
  });

  it("يصرّح بضبط الكلمات لفقرة Word المضبوطة", () => {
    const p = { bidi: true, jc: "both", spacing: {}, runs: [], tabStops: [] } as Parameters<typeof paragraphCss>[0];
    expect(paragraphCss(p)).toContain("text-justify:inter-word");
  });

  it.each([
    ["both", "word"], ["distribute", "distribute"], ["thaiDistribute", "distribute"],
    ["lowKashida", "lowKashida"], ["mediumKashida", "mediumKashida"], ["highKashida", "highKashida"],
  ])("يحفظ وضع Word %s مستقلًا", (jc, expected) => {
    expect(wordJustification(jc)).toBe(expected);
  });

  it("يفرق توزيع المحارف والسطر الأخير عن الضبط العادي", () => {
    const p = { bidi: true, jc: "distribute", spacing: {}, runs: [], tabStops: [] } as Parameters<typeof paragraphCss>[0];
    expect(paragraphCss(p)).toContain("text-justify:inter-character");
    expect(paragraphCss(p)).toContain("text-align-last:justify");
  });

  it("لا يحول أوضاع الكشيدة إلى توزيع مسافات", () => {
    const p = { bidi: true, jc: "mediumKashida", spacing: {}, runs: [], tabStops: [] } as Parameters<typeof paragraphCss>[0];
    expect(paragraphCss(p)).toContain("text-align:justify");
    expect(paragraphCss(p)).toContain("text-justify:auto");
    expect(paragraphCss(p)).not.toContain("text-justify:inter-word");
  });

  it("لا يحوّل atLeast الصغير إلى ارتفاع ثابت يراكم الأسطر", () => {
    const p = {
      bidi: true,
      jc: "both",
      spacing: { line: 18, lineRule: "atLeast" },
      runs: [{ emTwips: 320 }],
      tabStops: [],
    } as Parameters<typeof paragraphCss>[0];
    expect(paragraphCss(p)).not.toContain("line-height:");
  });

  it("يحفظ حد atLeast عندما يتجاوز ارتفاع الخط الطبيعي", () => {
    const p = {
      bidi: true,
      jc: "both",
      spacing: { line: 480, lineRule: "atLeast" },
      runs: [{ emTwips: 320 }],
      tabStops: [],
    } as Parameters<typeof paragraphCss>[0];
    expect(paragraphCss(p)).toContain("line-height:32px");
  });

  it("لا يضغط auto دون صندوق الحروف الطبيعي", () => {
    const p = {
      bidi: true,
      jc: "left",
      spacing: { line: 192, lineRule: "auto" },
      runs: [{ emTwips: 320 }],
      tabStops: [],
    } as Parameters<typeof paragraphCss>[0];
    const style = paragraphCss(p);
    expect(style).toContain("direction:rtl");
    expect(style).toContain("text-align:left");
    expect(style).not.toContain("line-height:0.8");
  });
});

const SUROOR = new URL("../../../../../../الكتب والمقالات/أبو أنس الشامي.. عمر يوسف جمعة/سرور.. بل أحزان.docx", import.meta.url);
const describeSuroor = describe.skip;
describeSuroor("انحدار سرور بل أحزان الحقيقي", () => {
  let model: ReturnType<typeof extractFromDocx>;
  beforeAll(() => { model = extractFromDocx(readFileSync(SUROOR)); });

  it("لا يحول تباعد 0.8 التلقائي إلى صندوق CSS متداخل", () => {
    const compact = model.paragraphs.filter(p => p.spacing.lineRule === "auto" && p.spacing.line === 192);
    expect(compact.length).toBeGreaterThan(30);
    for (const paragraph of compact)
      expect(paragraphCss(paragraph, model.sections[paragraph.sectionIndex]))
        .not.toContain("line-height:0.8");
  });

  it("يحفظ اتجاه RTL مستقلًا عن المحاذاة المادية", () => {
    const bidi = model.paragraphs.filter(p => p.bidi);
    expect(bidi.length).toBeGreaterThan(30);
    const syntheticLeft = { ...bidi[0]!, jc: "left" };
    const style = paragraphCss(syntheticLeft, model.sections[syntheticLeft.sectionIndex]);
    expect(style).toContain("direction:rtl");
    expect(style).toContain("text-align:left");
  });
});

const ZAHAR = new URL("../../../../../كتب للاختبار/زهر الخمائل في مسائل النوازل.docx", import.meta.url);
const describeZahar = existsSync(ZAHAR) ? describe : describe.skip;
describeZahar("انحدار زهر الخمائل الحقيقي", () => {
  const model = extractFromDocx(readFileSync(ZAHAR));

  it("يحفظ أوجه الخطوط المضمنة بدل تسجيلها كلها normal", () => {
    const faces = [...model.embeddedFonts.values()];
    expect(faces).toHaveLength(38);
    expect(faces.some(face => face.weight === "700")).toBe(true);
    expect(faces.some(face => face.style === "italic")).toBe(true);
    expect(model.embeddedFonts.get("font34.odttf")?.family).toBe("29LT Bukra Bold");
    expect(model.embeddedFonts.get("font35.odttf")?.family).toBe("29LT Bukra Bold");
  });

  it("يحفظ corpus محاذاة علامات القوائم بدل تسويتها إلى start", () => {
    const alignments = [...model.numbering.values()].map(level => level.jc).filter(Boolean);
    expect(alignments.length).toBeGreaterThan(0);
    expect(alignments.some(jc => jc === "left" || jc === "right" || jc === "center")).toBe(true);
  });

  it("يحفظ atLeast=18 كحد أدنى ولا يحوله إلى سطر 1.2px", () => {
    const paragraphs = model.paragraphs.filter(p => p.spacing.lineRule === "atLeast" && p.spacing.line === 18);
    expect(paragraphs.length).toBeGreaterThan(2_000);
    for (const paragraph of paragraphs.slice(0, 25))
      expect(paragraphCss(paragraph)).not.toContain("line-height:1.2px");
  });

  it("يحفظ مراسي الزخارف المرتبطة بفقرتها مستقلة", () => {
    const owners = model.paragraphs.filter(p => p.anchors.some(a => a.posVRel === "paragraph"));
    expect(owners.length).toBeGreaterThan(100);
    expect(new Set(owners.map(p => p.index)).size).toBe(owners.length);
    const repeatedOrnaments = owners.flatMap(p => p.anchors
      .filter(a => a.posVRel === "paragraph" && a.posVOffset === 96)
      .map(() => p.index));
    expect(repeatedOrnaments.length).toBeGreaterThan(50);
    expect(new Set(repeatedOrnaments).size).toBe(repeatedOrnaments.length);
  });

  it("يحفظ انعكاسات عنوان الغلاف السبعة بهندستها الفعلية", () => {
    const reflected = model.paragraphs.flatMap(p => p.runs).filter(run => run.textReflection);
    expect(reflected).toHaveLength(7);
    expect(reflected.every(run => run.textReflection?.scaleY === -1
      && run.textReflection.startOpacity === .28
      && run.textReflection.endPosition === .45)).toBe(true);
  });
});

const QURAN_ROAD = new URL("file:///C:/Users/Windows_OS/Documents/%D8%A7%D9%84%D9%85%D9%83%D8%AA%D8%A8%D8%A9/%D8%A7%D9%84%D8%B7%D8%B1%D9%8A%D9%82%20%D8%A5%D9%84%D9%89%20%D8%A7%D9%84%D9%82%D8%B1%D8%A2%D9%86.docx");
const describeQuranRoad = existsSync(QURAN_ROAD) ? describe : describe.skip;
describeQuranRoad("QA-004 — الطريق إلى القرآن", () => {
  const model = extractFromDocx(readFileSync(QURAN_ROAD));
  const pages = groupPages(model);

  it("يطابق 72 صفحة مادية ويفصلها عن أعلى رقم معدل 73", () => {
    expect(model.paragraphs).toHaveLength(713);
    expect(pages).toHaveLength(72);
    expect(documentPageNumbers(model, pages).at(-1)).toBe(73);
  });

  it("يثبت ملكية التنقل: bookmarks إلى slots 6/17/46 وتسميات Word 8/19/48", () => {
    const ids = ["_Toc181021125", "_Toc181021127", "_Toc181021134"];
    // هذا الفهرس هو عقد القارئ المشترك: zero-based slot. طبقة UI وحدها تضيف
    // واحدًا عند عرض رقم الورقة الفيزيائية للمستخدم، ولا تغيّر هدف bookmark.
    const slots = ids.map(id => pages.findIndex(page => page.some(p => p.bookmarkIds?.includes(id))));
    const adjusted = documentPageNumbers(model, pages);
    expect(slots).toEqual([6, 17, 46]);
    expect(slots.map(slot => adjusted[slot])).toEqual([8, 19, 48]);
  });

  it("يطابق نص Word الخام مع إبقاء غليف AGA في نص العرض", () => {
    const symbolRun = model.paragraphs.flatMap(p => p.runs)
      .find(run => run.family === "AGA Arabesque" && run.text === "\uF072");
    expect(symbolRun?.sourceText).toBe("(");
    expect(symbolRun?.text).toBe("\uF072");
    expect(model.paragraphs.filter(p => p.text).length).toBe(703);
  });
});

describe("تعدد حدود الصفحة", () => {
  it("ينشئ صفحة فارغة بين حدين قبل الفقرة", () => {
    const p = (index: number, pageBreaksBefore: number) => ({ index, pageBreaksBefore,
      pageBreakBefore: pageBreaksBefore > 0 }) as Parameters<typeof groupPages>[0]["paragraphs"][number];
    const pages = groupPages({ paragraphs: [p(0, 0), p(1, 2)] } as Parameters<typeof groupPages>[0]);
    expect(pages.map(page => page.map(item => item.index))).toEqual([[0], [], [1]]);
  });

  it("لا يصنع صفحة بيضاء قبل غلاف يبدأ بعد فقرة بنيوية فارغة", () => {
    const structural = { index: 0, pageBreakBefore: false, pageBreaksBefore: 0,
      text: "", runs: [], anchors: [], tableCell: null } as unknown as Parameters<typeof groupPages>[0]["paragraphs"][number];
    const cover = { ...structural, index: 1, pageBreakBefore: true, pageBreaksBefore: 1,
      anchors: [{ rId: "cover" }] } as unknown as Parameters<typeof groupPages>[0]["paragraphs"][number];
    expect(groupPages({ paragraphs: [structural, cover] } as Parameters<typeof groupPages>[0])
      .map(page => page.map(item => item.index))).toEqual([[0, 1]]);
  });
});

describe("رأس الصفحة الأولى المختلفة", () => {
  it("يحوّل framePr المقاس بالـtwips إلى صندوق مطلق داخل قصة النص", () => {
    const style = framePrCss({ signature: "f", w: 715, h: null, x: null, y: 5,
      hSpace: 0, vSpace: 0, hAnchor: "text", vAnchor: "text",
      xAlign: null, yAlign: null, wrap: "around" });
    expect(style).toContain("position:absolute");
    expect(style).toContain("width:47.667px");
    expect(style).toContain("top:0.333px");
    expect(style).toContain("left:0px");
  });

  it("يبقي framePr بلا عرض على قياس محتواه بدل قلب رقم PAGE إلى يمين قصة RTL", () => {
    const style = framePrCss({ signature: "auto", w: null, h: null, x: null, y: 1,
      hSpace: 0, vSpace: 0, hAnchor: "text", vAnchor: "text",
      xAlign: null, yAlign: null, wrap: "around" });
    expect(style).toContain("left:0px");
    expect(style).toContain("width:max-content");
    expect(style).not.toContain("right:0");
  });

  it("يضع مرساة topMargin داخل منطقة الهامش لا بعد بداية المتن", () => {
    const node = new FakeNode("div") as unknown as HTMLElement;
    const page = new FakeNode("div") as unknown as HTMLElement;
    positionFloatingAnchor(node, {
      extentW: 9190, extentH: 269, posHRel: "margin", posHOffset: -889,
      posVRel: "topMargin", posVOffset: 523, posHAlign: null, posVAlign: null,
      behindDoc: false, zOrder: 1, distL: 0, distR: 0, distT: 0, distB: 0,
      wrap: "None", rId: null,
    }, 0, {
      pageWTwips: 11907, pageHTwips: 16839, marLeftTwips: 1800, marRightTwips: 1800,
      marTopTwips: 1440, marBottomTwips: 1440,
    } as Parameters<typeof positionFloatingAnchor>[3], page, "header");
    // CSS offset cancels the 96px page padding: the physical result remains
    // 523twips from the sheet edge.
    expect(parseFloat(node.style.top)).toBeCloseTo(-61.13, 1);
  });

  it.runIf(existsSync(IBHAJ_SANITIZED))("يحافظ على غلاف إبهاج عند حافة الورقة وتذييله عند الحافة السفلية", () => {
    const model = extractFromDocx(readFileSync(IBHAJ_SANITIZED));
    const section = model.sections[0]!;
    const cover = model.paragraphs.flatMap(paragraph => paragraph.anchors)
      .find(anchor => anchor.vml && anchor.rId);
    expect(section).toMatchObject({ pageWTwips: 11906, pageHTwips: 16838,
      marLeftTwips: 2275, marRightTwips: 2275, marTopTwips: 2275, marBottomTwips: 2275 });
    expect(cover).toMatchObject({ posHRel: "column", posHOffset: -2280,
      posVRel: "paragraph", posVOffset: -2275, extentW: 11918, extentH: 16836 });

    const node = new FakeNode("div") as unknown as HTMLElement;
    const page = new FakeNode("div") as unknown as HTMLElement;
    positionFloatingAnchor(node, cover!, 1, section, page);
    fillPageWithCover(node, section);
    expect(parseFloat(node.style.left)).toBeCloseTo(-151.667, 3);
    expect(parseFloat(node.style.top)).toBeCloseTo(-151.667, 3);
    expect(parseFloat(node.style.width)).toBeCloseTo(793.733, 3);

    const footer = headerFooterElement(model, section, 1, "footer", newRenderCtx(model), "2", 22, 22);
    expect(footer).not.toBeNull();
    expect((footer as unknown as FakeNode).attrs.get("style")).toContain("bottom:-75.8px");
    const frames = descendants(footer as unknown as FakeNode, "div")
      .filter(child => child.attrs.get("class") === "word-frame");
    expect(frames).toHaveLength(1);
    expect(frames[0]!.attrs.get("style")).toContain("width:max-content");
    expect((footer as unknown as FakeNode).textContent).toContain("(2)");
    expect((footer as unknown as FakeNode).textContent).toContain("منبر التوحيد والجهاد");
  });

  it("لا يسقط إلى default عندما titlePg مفعّل ومرجع first غير موجود", () => {
    const model = {
      evenAndOddHeaders: false,
      relTargets: new Map([["rDefault", "word/header1.xml"]]),
    } as unknown as Parameters<typeof headerFooterPartName>[0];
    const section = {
      titlePg: true,
      headerRefs: { default: "rDefault" },
    } as unknown as Parameters<typeof headerFooterPartName>[1];
    expect(headerFooterPartName(model, section, 0, "header")).toBeNull();
    expect(headerFooterPartName(model, section, 1, "header")).toBe("header1.xml");
  });
});

describe("زوجية الرأس حسب رقم صفحة Word", () => {
  it("لا يعيد نمط even من أول كل section", () => {
    const model = { evenAndOddHeaders: true } as Parameters<typeof headerFooterType>[0];
    const section = { titlePg: false, pgNumStart: null } as Parameters<typeof headerFooterType>[1];
    // الصفحة الأولى في هذا المقطع هي الصفحة 6 من المستند، وإن كان فهرسها المحلي صفرًا.
    expect(headerFooterType(model, section, 0, 6)).toBe("even");
    expect(headerFooterType(model, section, 1, 7)).toBe("default");
  });

  it("يحترم استئناف ترقيم المقطع عند غياب الرقم الصريح من المستدعي", () => {
    const model = { evenAndOddHeaders: true } as Parameters<typeof headerFooterType>[0];
    const section = { titlePg: false, pgNumStart: 2 } as Parameters<typeof headerFooterType>[1];
    expect(headerFooterType(model, section, 0)).toBe("even");
    expect(headerFooterType(model, section, 1)).toBe("default");
  });
});

describe("STYLEREF في الرأس", () => {
  it("يأخذ أول عنوان في الصفحة ثم يرجع إلى أقرب عنوان سابق", () => {
    const preceding = new Map([["2", "عنوان سابق"]]);
    const page = [
      { styleId: null, text: "متن" },
      { styleId: "2", text: "عنوان الصفحة" },
      { styleId: "2", text: "عنوان لاحق في الصفحة" },
    ] as Parameters<typeof styleRefValuesForPage>[0];
    expect(styleRefValuesForPage(page, preceding).get("2")).toBe("عنوان الصفحة");
    const plain = [{ styleId: null, text: "متن" }] as typeof page;
    expect(styleRefValuesForPage(plain, preceding).get("2")).toBe("عنوان سابق");
  });
});

describe("فصل الرأس والتذييل عن المتن", () => {
  const anchor = (behindDoc: boolean, wrap: string) => ({ behindDoc, wrap }) as Parameters<typeof headerFooterAnchorReservesSpace>[0];

  it("لا تدفع العلامة المائية الخلفية المتن", () => {
    expect(headerFooterAnchorReservesSpace(anchor(true, "Square"))).toBe(false);
  });

  it("تحجز كل صورة أمامية مساحة حتى إن كانت حرة بلا التفاف", () => {
    expect(headerFooterAnchorReservesSpace(anchor(false, "None"))).toBe(true);
    expect(headerFooterAnchorReservesSpace(anchor(false, "Square"))).toBe(true);
    expect(headerFooterAnchorReservesSpace(anchor(false, "TopAndBottom"))).toBe(true);
  });

  it("لا تدفع خلفية رأس كبيرة من Wrap=None متن الصفحة", () => {
    const section = { pageWTwips: 12000, pageHTwips: 16800, marTopTwips: 1440, marBottomTwips: 1440 } as Parameters<typeof headerFooterAnchorReservesSpace>[1];
    const large = { behindDoc: false, wrap: "None", extentW: 12000, extentH: 9000 } as Parameters<typeof headerFooterAnchorReservesSpace>[0];
    const logo = { behindDoc: false, wrap: "None", extentW: 1800, extentH: 500 } as Parameters<typeof headerFooterAnchorReservesSpace>[0];
    expect(headerFooterAnchorReservesSpace(large, section, "header")).toBe(false);
    expect(headerFooterAnchorReservesSpace(logo, section, "header")).toBe(true);
  });

  it("يحسب التداخل في فضاء الصفحة المحلي لا بعد المقياس", () => {
    expect(storyClearancePx(160, 140, 2)).toBe(22);
    expect(storyClearancePx(120, 140, 2)).toBe(0);
  });
});

describe("مراسي DrawingML المرتبطة بالفقرة", () => {
  it("يحفظ أبعاد وملكية صور ص3 من توحيد الحاكمية دون ضغط responsive", () => {
    expect(existsSync(TAWHID)).toBe(true);
    const model = extractFromDocx(readFileSync(TAWHID));
    const ctx = newRenderCtx(model);
    const pageThreePictureParagraphs = model.paragraphs.slice(2, 8)
      .filter(paragraph => paragraph.anchors.some(anchor => anchor.inlineFlow));

    expect(pageThreePictureParagraphs.map(paragraph => paragraph.index)).toEqual([5, 8]);
    const pictures = pageThreePictureParagraphs.flatMap(paragraph => {
      const node = paragraphToElement(paragraph, ctx) as unknown as FakeNode;
      return node.children.filter(child => child.dataset.wordInlineImage === "true");
    });
    expect(pictures).toHaveLength(2);
    expect(pictures.map(picture => picture.attrs.get("style"))).toEqual([
      expect.stringContaining("width:503.4px;height:513.133px"),
      expect.stringContaining("width:188px;height:53.2px"),
    ]);
    expect(pictures.every(picture => picture.attrs.get("style")?.includes("max-width:none"))).toBe(true);
  });

  it("يبقي الفقرة الخالية إذا كانت أصل إحداثيات لزخرفة عائمة", () => {
    const p = {
      index: 418, bidi: true, jc: "center", spacing: {}, runs: [],
      text: "", tabStops: [], ptabAt: [], tabAt: [], bookmarkIds: [], tableCell: null,
      shd: null, pBdr: null,
      anchors: [{ posVRel: "paragraph", posVOffset: 96 }],
    } as unknown as Parameters<typeof paragraphToElement>[0];
    const rendered = paragraphToElement(
      p, newRenderCtx({} as Parameters<typeof newRenderCtx>[0]),
    ) as unknown as FakeNode;
    expect(rendered).not.toBeNull();
    expect(rendered.dataset.idx).toBe("418");
  });

  it("يحفظ هوية الفقرة المالكة حتى في مسار التبويب الموضعي", () => {
    const p = {
      index: 417, bidi: true, jc: "both", spacing: {},
      runs: [{ text: "يمين" }, { text: "وسط" }, { text: "يسار" }],
      text: "يمين\tوسط\tيسار", tabStops: [], ptabAt: [1, 2], tabAt: [],
      anchors: [], bookmarkIds: [], tableCell: null,
    } as unknown as Parameters<typeof paragraphToElement>[0];
    const rendered = paragraphToElement(
      p, newRenderCtx({} as Parameters<typeof newRenderCtx>[0]),
    ) as unknown as FakeNode;
    expect(rendered.dataset.idx).toBe("417");
  });

  it("يحسب موضع كل زخرفة من فقرتها لا من هامش الصفحة المشترك", () => {
    // 60960 EMU في حالة «زهر الخمائل» = 96 twips بعد التحليل.
    expect(paragraphAnchorTop(120, 96)).toBeCloseTo(126.4, 3);
    expect(paragraphAnchorTop(420, 96)).toBeCloseTo(426.4, 3);
    expect(paragraphAnchorTop(120, 96)).not.toBe(paragraphAnchorTop(420, 96));
  });

  it("لا يرسم الزخرفة في موضع مشترك قبل حل الفقرة ثم يظهرها في موضعها", () => {
    const oldRaf = globalThis.requestAnimationFrame;
    let queued: FrameRequestCallback | null = null;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { queued = cb; return 1; }) as typeof requestAnimationFrame;
    try {
      const attrs = new Map<string, string>();
      const node = { style: {} as Record<string, string>, setAttribute: (k: string, v: string) => attrs.set(k, v),
        getAttribute: (k: string) => attrs.get(k) ?? null } as unknown as HTMLElement;
      const owner = { dataset: {}, getBoundingClientRect: () => ({ top: 220, left: 100, width: 500, height: 20,
        right: 600, bottom: 240, x: 100, y: 220, toJSON() {} }) } as unknown as HTMLElement;
      const listeners = new Map<string, EventListener>();
      const page = { offsetWidth: 800, querySelector: () => owner,
        getBoundingClientRect: () => ({ top: 20, left: 20, width: 800, height: 1100,
          right: 820, bottom: 1120, x: 20, y: 20, toJSON() {} }),
        addEventListener: (name: string, cb: EventListener) => listeners.set(name, cb),
      } as unknown as HTMLElement;
      positionFloatingAnchor(node, { extentW: 625, extentH: 646, posHRel: "column", posHOffset: 8304,
        posVRel: "paragraph", posVOffset: 96, posHAlign: null, posVAlign: null,
        behindDoc: false, zOrder: 1, distL: 0, distR: 0, distT: 0, distB: 0,
        wrap: "None", rId: "rDecor" }, 171, {
        pageWTwips: 12000, pageHTwips: 16800, marLeftTwips: 1440, marRightTwips: 1440,
        marTopTwips: 1440, marBottomTwips: 1440,
      } as Parameters<typeof positionFloatingAnchor>[3], page);
      expect(node.style.visibility).toBe("hidden");
      expect(attrs.get("data-word-anchor-owner")).toBe("171");
      (queued as FrameRequestCallback | null)?.(0);
      expect(node.style.visibility).toBe("");
      expect(attrs.get("data-word-anchor-resolved")).toBe("true");
      expect(parseFloat(node.style.top)).toBeCloseTo(206.4, 3);
      expect(listeners.has("word-layout")).toBe(true);
    } finally {
      if (oldRaf) globalThis.requestAnimationFrame = oldRaf;
      else delete (globalThis as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    }
  });
});

describe("انحدار ترسيم منهاج مخيم جيل العزة", () => {
  it("يرسم corpus كاملًا دون exception ويحفظ عدد حدود صفحاته", () => {
    expect(existsSync(MINHAJ_CAMP)).toBe(true);
    const model = extractFromDocx(readFileSync(MINHAJ_CAMP));
    const root = renderDocument(model) as unknown as FakeNode;
    expect(model.paragraphs).toHaveLength(558);
    expect(root.children).toHaveLength(59);
  });

  it("يكرر رأس جدول الإيقاع اليومي في صفحات Word 11–14", () => {
    const model = extractFromDocx(readFileSync(MINHAJ_CAMP));
    const groups = groupsAt(model, MINHAJ_WORD_MODEL_STARTS);
    for (const physicalPage of [11, 12, 13, 14]) {
      const blocks = renderPageBlocks(groups[physicalPage - 1]!, model.section, newRenderCtx(model)) as unknown as FakeNode[];
      const table = blocks.find(node => node.tag === "table");
      expect(table, `page ${physicalPage}`).toBeDefined();
      expect(table!.textContent).toContain("الوقت (تقريبي)");
      expect(table!.textContent).toContain("ملاحظات التنفيذ");
    }
  });
});

describe("حواشي توحيد الحاكمية على صفحات Word", () => {
  it("لا يفعل linePitch منفردًا عندما يغيب نوع شبكة الأسطر", () => {
    const model = extractFromDocx(readFileSync(TAWHID));
    expect(model.section.docGridLinePitch).toBe(360);
    expect(model.section.docGridType).toBeNull();
    const paragraph = model.paragraphs.find(item => item.runs.some(run => (run.emTwips ?? 0) > 0))!;
    expect(paragraphCss(paragraph, model.section)).not.toContain("line-height:24px");
  });

  it("يحفظ المراجع 1..7 في أوراقها الموثقة ولا ينقلها مع حدود XML", () => {
    const model = extractFromDocx(readFileSync(TAWHID));
    const groups = groupsAt(model, TAWHID_WORD_STARTS);
    renumberNoteRefsForPages(model, groups);
    const doc = renderDocument(model, groups) as unknown as FakeNode;
    const footnoteText = doc.children.map(page => {
      const body = page.children.find(node => node.attrs.get("class") === "page-body");
      return body?.children.find(node => node.attrs.get("class") === "page-footnotes")?.textContent ?? "";
    });
    expect(footnoteText.map((text, index) => text ? index + 1 : null).filter(Boolean))
      .toEqual([8, 9, 10, 13, 23, 24]);
    expect(footnoteText[7]).toContain("1 تعريف بسيرة الشيخ أبي طلال");
    expect(footnoteText[8]).toContain("2 سورة النمل");
    expect(footnoteText[9]).toContain("3 سورة النساء");
    expect(footnoteText[12]).toContain("4 (القيامة:14-15)");
    expect(footnoteText[22]).toContain("5 [ النساء : 65 ]6 [ النساء : 65 ]");
    expect(footnoteText[23]).toContain("7 [ النور : 63 ]");
  });
});

describe("جداول الحواشي ومنع انقسام صفوفها", () => {
  it("يبني جدول الحاشية المصغر ولا يحوله إلى فقرات مسطحة", () => {
    const base = {
      index: 0, sectionIndex: 0, text: "متن", runs: [{ text: "متن", noteRef: { id: "1", num: 1, kind: "footnote", fmt: "decimal" } }],
      anchors: [], bookmarkIds: [], tableCell: null, spacing: {}, tabStops: [], ptabAt: [], tabAt: [],
      pBdr: null, shd: null, framePr: null, toc: null, excluded: null,
    };
    const cell = (index: number, col: number, text: string) => ({ ...base, index, text, runs: [{ text }],
      tableCell: {
        tableId: 1, row: 0, col, colXTwips: col * 2000, colWTwips: 2000, gridSpan: 1,
        firstInCell: true, firstInRow: col === 0, lastInRow: col === 1, shdFill: null,
        tblStyleId: null, totalGridTwips: 4000, tblWVal: 4000, tblWType: "dxa", tblLayout: "fixed",
        cantSplit: true, repeatHeader: false, bidiVisual: true, tblIndTwips: 0, tblJc: null,
        vMerge: null, vAlign: null, marTop: 0, marBottom: 0, marLeft: 108, marRight: 108,
        rowHeight: null, rowHeightRule: null, textDirection: null, tcBorders: null,
      },
    });
    const section = { pageWTwips: 12000, pageHTwips: 16000, marTopTwips: 1000, marBottomTwips: 1000,
      marLeftTwips: 1000, marRightTwips: 1000, colCount: 1, colSpaceTwips: 0 };
    const model = { paragraphs: [base], footnotes: new Map([["1", [cell(1, 0, "يمين"), cell(2, 1, "يسار")]]]),
      endnotes: new Map(), headerFooters: new Map(), sections: [section], section,
      noteSettings: { footnote: { start: 1, restart: "continuous", fmt: "decimal", position: "pageBottom" } },
    } as unknown as ReturnType<typeof extractFromDocx>;
    const block = footnotesBlock(model, [base] as typeof model.paragraphs, newRenderCtx(model)) as unknown as FakeNode;
    const table = descendants(block, "table");
    expect(table).toHaveLength(1);
    expect(descendants(table[0]!, "tr")[0]!.attrs.get("style")).toContain("break-inside:avoid");
    expect(table[0]!.textContent).toBe("يمينيسار");
  });

  it("يحفظ جدول الحاشية 219 في corpus كجدول ذي أربعة صفوف غير قابلة للانقسام", () => {
    expect(existsSync(FOOTNOTE_TABLE_BOOK)).toBe(true);
    const model = extractFromDocx(readFileSync(FOOTNOTE_TABLE_BOOK));
    const owner = model.paragraphs.find(paragraph => paragraph.runs.some(run => run.noteRef?.id === "219"));
    expect(owner).toBeDefined();
    const block = footnotesBlock(model, [owner!], newRenderCtx(model)) as unknown as FakeNode;
    const tables = descendants(block, "table");
    expect(tables).toHaveLength(1);
    const rows = descendants(tables[0]!, "tr");
    expect(rows).toHaveLength(4);
    expect(rows.every(row => row.attrs.get("style")?.includes("break-inside:avoid"))).toBe(true);
    expect(tables[0]!.textContent).toContain("اللَّهُمَّ ‌لَوْلَا ‌أَنْتَ ‌مَا ‌اهْتَدَيْنَا");
    expect(tables[0]!.textContent).toContain("وَبِالصِّيَاحِ عَوَّلُوا عَلَيْنَا");
  });
});

describe.runIf(existsSync(USUS_NOTES))("حاشية corpus متعددة الفقرات", () => {
  it("يرسم الحاشية 18 مدخلًا واحدًا ورقمًا واحدًا وفق Word PDF", () => {
    const model = extractFromDocx(readFileSync(USUS_NOTES));
    const owner = model.paragraphs.find(paragraph => paragraph.runs.some(run => run.noteRef?.id === "18"));
    expect(owner).toBeDefined();
    const block = footnotesBlock(model, [owner!], newRenderCtx(model)) as unknown as FakeNode;
    const entries = descendants(block, "div")
      .filter(node => node.attrs.get("class") === "fn-entry");
    const entry = entries.find(node => node.textContent.includes("صحيح مسلم"));
    expect(entry).toBeDefined();
    expect(descendants(entry!, "sup")).toHaveLength(1);
    const body = descendants(entry!, "div").find(node => node.attrs.get("class") === "fn-body");
    expect(body?.children).toHaveLength(2);
    expect(entry!.textContent).toContain("صحيح البخاري");
    expect(entry!.textContent).toContain("صحيح مسلم");
  });
});

describe.runIf(existsSync(OPENXML_GREETING_LINE))("Open XML SDK GREETINGLINE DOM", () => {
  it("يرسم نتيجة الحقل المخزنة ولا يسقط فقرتها", () => {
    const model = extractFromDocx(readFileSync(OPENXML_GREETING_LINE));
    const doc = renderDocument(model) as unknown as FakeNode;
    expect(doc.textContent).toContain("«GreetingLine»");
  });
});

describe.runIf(existsSync(OPENXML_TABLE_CELL_2_PARA))("Open XML SDK multi-paragraph table cell DOM", () => {
  it("يرسم اثنتي عشرة خلية وتبقى فقرتا الخلية الأولى داخل td واحدة", () => {
    const model = extractFromDocx(readFileSync(OPENXML_TABLE_CELL_2_PARA));
    const blocks = renderPageBlocks(model.paragraphs, model.section, newRenderCtx(model)) as unknown as FakeNode[];
    const table = blocks.find(node => node.tag === "table")!;
    const cells = descendants(table, "td");
    expect(cells).toHaveLength(12);
    expect(cells[0]!.textContent).toBe("Paragraph inside a table cellPara2 inside a table cell");
    expect(cells[0]!.children).toHaveLength(2);
  });
});

describe("فواصل الأعمدة الموثقة في corpus", () => {
  it("يقسم الفقرة المصغرة إلى كتلتين ويحذف محرف السطر التمثيلي", () => {
    const paragraph = { text: "قبل\nبعد", columnBreak: true, columnBreakAt: [3],
      runs: [{ text: "قبل\nبعد", hidden: false }], anchors: [], bookmarkIds: [] } as unknown as Parameters<typeof columnFragments>[0];
    const fragments = columnFragments(paragraph);
    expect(fragments.map(fragment => fragment.text)).toEqual(["قبل", "بعد"]);
    expect(fragments.flatMap(fragment => fragment.runs.map(run => run.text)).join(""))
      .toBe("قبلبعد");
  });

  it("يحفظ مواضع الفواصل الستة في زاد المجاهد والاثنين في الديوان", () => {
    const poetry = extractFromDocx(readFileSync(POETRY));
    const zaad = extractFromDocx(readFileSync(ZAAD));
    expect(poetry.paragraphs.filter(paragraph => paragraph.columnBreakAt?.length)).toHaveLength(2);
    expect(zaad.paragraphs.filter(paragraph => paragraph.columnBreakAt?.length)).toHaveLength(6);
    const paragraph = zaad.paragraphs.find(item => item.text.includes("عدد مغازي وبعوث النبي"))!;
    const blocks = renderPageBlocks([paragraph], zaad.section, newRenderCtx(zaad)) as unknown as FakeNode[];
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.textContent).toContain("ـــــــــ");
    expect(blocks[1]!.textContent).toContain("عدد مغازي وبعوث النبي");
    expect(blocks[1]!.style.breakBefore).toBe("column");
  });
});

describe("ديوان هموم وآلام — الغلاف وبنية الشعر", () => {
  it("يبقي صورة الغلاف VML كاملة في الصفحة الأولى المعروضة", () => {
    expect(existsSync(POETRY)).toBe(true);
    const model = extractFromDocx(readFileSync(POETRY));
    const pages = groupPages(model);
    const coverOwner = pages[0]?.find(paragraph => paragraph.anchors.some(anchor => {
      const target = anchor.rId ? model.relTargets.get(anchor.rId)?.replace(/^\.\.\//, "") : null;
      return target === "media/image1.jpeg" || target === "media/image6.jpeg";
    }));
    expect(coverOwner).toBeDefined();
    const revoked = vi.spyOn(URL, "revokeObjectURL");
    const rendered = renderDocument(model) as unknown as FakeNode;
    const firstPage = rendered.children.find(node => (node.attrs.get("class") ?? "").split(/\s+/).includes("page"))!;
    const images = descendants(firstPage, "img");
    expect(images.some(image => /image(?:1|6)\.jpeg/.test(image.attrs.get("src") ?? "") || image.attrs.get("src")?.startsWith("blob:"))).toBe(true);
    const cleanup = takeRenderedAssetCleanup(rendered as unknown as HTMLElement);
    expect(cleanup).toBeTypeOf("function");
    cleanup?.();
    const released = revoked.mock.calls.length;
    expect(released).toBeGreaterThan(0);
    cleanup?.();
    expect(revoked).toHaveBeenCalledTimes(released);
    revoked.mockRestore();
  });

  it("يحفظ جداول الأبيات كجداول لا يحول الشطرين إلى فقرات متداخلة", () => {
    const model = extractFromDocx(readFileSync(POETRY));
    const tableCells = model.paragraphs.filter(paragraph => paragraph.tableCell);
    expect(tableCells.length).toBeGreaterThan(100);
    expect(new Set(tableCells.map(paragraph => paragraph.tableCell?.tableId)).size).toBeGreaterThan(20);
  });

  it("يجعل زخرفة رمضان والجهاد سطرية فتحجز ارتفاعها ولا تغطي الأبيات", () => {
    const model = extractFromDocx(readFileSync(POETRY));
    const titleIndex = model.paragraphs.findIndex(paragraph => paragraph.text.includes("رَمَضَانُ وَالجِهَادُ"));
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    const decoration = model.paragraphs.slice(titleIndex + 1, titleIndex + 4)
      .flatMap(paragraph => paragraph.anchors)
      .find(anchor => anchor.extentW === 4040 && anchor.extentH === 850);
    expect(decoration).toBeDefined();
    expect(decoration?.vml).toBe(true);
    expect(decoration?.inlineFlow).toBe(true);
  });
});

describe("ترجمة أنماط إطارات Word إلى CSS صالح", () => {
  it("يحافظ على الأنماط القياسية", () => {
    expect(wordBorderStyle("single")).toBe("solid");
    expect(wordBorderStyle("double")).toBe("double");
    expect(wordBorderStyle("dashed")).toBe("dashed");
    expect(wordBorderStyle("dotted")).toBe("dotted");
  });

  it("لا يُسقط الأنماط المركبة أو الفنية بقيمة CSS غير صالحة", () => {
    expect(wordBorderStyle("dashSmallGap")).toBe("dashed");
    expect(wordBorderStyle("dotDotDash")).toBe("dotted");
    expect(wordBorderStyle("thinThickSmallGap")).toBe("double");
    expect(wordBorderStyle("doubleWave")).toBe("double");
    expect(wordBorderStyle("apples")).toBe("solid");
  });

  it("يحافظ على حد الشكل المتقطع عند استعماله إطارًا لمربع نص", () => {
    const css = shapeFrameCss({ prst: "roundRect", fill: "FFF2CC", stroke: "4472C4", strokeW: 30, adj: null, dash: [30, 30] });
    expect(css.join(";")).toContain("background-color:#FFF2CC");
    expect(css.join(";")).toContain(" dashed #4472C4");
    expect(css.join(";")).toContain("border-radius:");
    expect(css.join(";")).not.toContain("border-style:2px");
  });

  it("يعرض linestyle المركب لحد VML كخط CSS مزدوج", () => {
    const style = shapeFrameCss({ prst: "rect", fill: null, stroke: "000000", strokeW: 20,
      adj: null, lineStyle: "thinThick" });
    expect(style.join(";")).toContain("double #000000");
  });

  it("يرسم VML spt=9 بهندسة سداسية نسبية", () => {
    const style = shapeFrameCss({ prst: "hexagon", fill: "CC0000", stroke: null, strokeW: 0, adj: null });
    expect(style).toContain("clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)");
  });

  it("يرسم تدرج fillRef بدل اختزاله إلى لون واحد", () => {
    const css = shapeFrameCss({ prst: "rect", fill: "000000", stroke: null, strokeW: 0, adj: null,
      gradient: { angle: 0, stops: [{ pos: 0, color: "333333" }, { pos: 1, color: "000000" }] } });
    expect(css.join(";")).toContain("background:linear-gradient(0deg,#333333 0%,#000000 100%)");
  });
});

describe("تنسيق أرقام الحواشي كما في Word", () => {
  it("يحفظ groupTable عنوان الخلية الأم للجدول المتداخل", () => {
    const tableCell = { tableId: 4, parentTableId: 3, parentRow: 1, parentCol: 2, nestingDepth: 2,
      row: 0, col: 0, colXTwips: 0, colWTwips: 1000, gridSpan: 1, totalGridTwips: 1000,
      bidiVisual: false, tblIndTwips: 0, tblJc: null, tblWVal: 0, tblWType: "auto",
      tblLayout: "autofit", cantSplit: false, repeatHeader: false, rowHeight: null,
      rowHeightRule: "auto", shdFill: null, vMerge: null, vAlign: null, textDirection: null,
      marTop: 0, marBottom: 0, marLeft: 0, marRight: 0, tcBorders: null };
    const data = groupTable([{ tableCell }] as unknown as Parameters<typeof groupTable>[0]);
    expect(data).toMatchObject({ tableId: 4, parentTableId: 3, parentRow: 1, parentCol: 2,
      nestingDepth: 2 });
  });

  it("يعلن fallback صادقًا للأعمدة غير المتساوية بدل اختلاق عرض متساو", () => {
    const paragraph = {
      index: 0, sectionIndex: 0, text: "متن", runs: [{ text: "متن" }], anchors: [],
      bookmarkIds: [], tableCell: null, spacing: {}, tabStops: [], ptabAt: [], tabAt: [],
      pBdr: null, shd: null, framePr: null, toc: null, excluded: null,
    };
    const section = {
      pageWTwips: 12000, pageHTwips: 16000, marTopTwips: 1000, marBottomTwips: 1000,
      marLeftTwips: 1000, marRightTwips: 1000, colCount: 2, colSpaceTwips: 300,
      explicitColumns: [{ widthTwips: 6000, spaceAfterTwips: 300 },
        { widthTwips: 3700, spaceAfterTwips: 300 }],
    };
    const model = { paragraphs: [paragraph], footnotes: new Map(), endnotes: new Map(),
      headerFooters: new Map(), sections: [section], section, numbering: new Map(), styles: new Map(),
    } as unknown as Parameters<typeof buildPageElement>[0];
    const page = buildPageElement(model, section as Parameters<typeof buildPageElement>[1],
      [paragraph] as Parameters<typeof buildPageElement>[2], 0, newRenderCtx(model));
    const body = (page as unknown as FakeNode).children.find(node => node.attrs.get("class") === "page-body")!;
    expect(body.dataset.wordUnsupportedColumns).toBe("unequal-widths");
    expect(body.style.columnCount).toBeUndefined();
  });

  it("يفصل حاشية pageBottom عن تدفق الأعمدة كي تبقى أسفل الصفحة بكامل العرض", () => {
    const paragraph = {
      index: 0, sectionIndex: 0, text: "متن", runs: [{ text: "متن", noteRef: { id: "1", num: 1, kind: "footnote", fmt: "decimal" } }],
      anchors: [], bookmarkIds: [], tableCell: null, spacing: {}, tabStops: [], ptabAt: [], tabAt: [],
      pBdr: null, shd: null, framePr: null, toc: null, excluded: null,
    };
    const note = { ...paragraph, index: 1, text: "نص الحاشية", runs: [{ text: "نص الحاشية" }] };
    const section = {
      pageWTwips: 12000, pageHTwips: 16000, marTopTwips: 1000, marBottomTwips: 1000,
      marLeftTwips: 1000, marRightTwips: 1000, colCount: 2, colSpaceTwips: 300,
      footnotePr: { position: "pageBottom" },
    };
    const model = {
      paragraphs: [paragraph], footnotes: new Map([["1", [note]]]), endnotes: new Map(),
      pageBackground: "548DD4",
      headerFooters: new Map(), sections: [section], section, noteSettings: {
        footnote: { start: 1, restart: "continuous", fmt: "decimal", position: "pageBottom" },
      }, numbering: new Map(), styles: new Map(),
    } as unknown as Parameters<typeof buildPageElement>[0];
    const page = buildPageElement(model, section as Parameters<typeof buildPageElement>[1],
      [paragraph] as Parameters<typeof buildPageElement>[2], 0, newRenderCtx(model));
    expect(page.style.backgroundColor).toBe("#548DD4");
    const body = (page as unknown as FakeNode).children.find(node => node.attrs.get("class") === "page-body")!;
    expect(body.children.map(node => node.attrs.get("class") ?? node.tag)).toContain("page-columns");
    const columns = body.children.find(node => node.attrs.get("class") === "page-columns")!;
    const footnotes = body.children.find(node => node.attrs.get("class") === "page-footnotes")!;
    expect(columns.attrs.get("data-word-column-flow")).toBe("separate-from-page-bottom-notes");
    expect(footnotes.dataset.wordNotePosition).toBe("pageBottom");
    expect(columns.children.length).toBeGreaterThan(0);
    expect(columns.children).not.toContain(footnotes);
  });

  it("يقدم موضع المقطع على إعداد المستند العام", () => {
    const model = { noteSettings: { footnote: { position: "pageBottom" } } } as Parameters<typeof notePositionForPage>[0];
    const section = { footnotePr: { position: "beneathText" } } as Parameters<typeof notePositionForPage>[1];
    expect(notePositionForPage(model, section, "footnote")).toBe("beneathText");
  });

  it("يسقط إلى pageBottom للحاشية عند غياب الإعداد", () => {
    expect(notePositionForPage({} as Parameters<typeof notePositionForPage>[0], {} as Parameters<typeof notePositionForPage>[1], "footnote")).toBe("pageBottom");
  });

  it("يختار فاصل الحاشية من قصتها لا من footnotes دائمًا", () => {
    const foot = [{}], continued = [{}, {}, {}], end = [{}, {}];
    const model = { footnotes: new Map([["-1", foot], ["0", continued]]), endnotes: new Map([["-1", end]]) } as unknown as Parameters<typeof noteSeparatorParagraphs>[0];
    expect(noteSeparatorParagraphs(model, "footnote")).toBe(foot);
    expect(noteSeparatorParagraphs(model, "footnote", true)).toBe(continued);
    expect(noteSeparatorParagraphs(model, "endnote")).toBe(end);
  });

  it("يعيد eachPage من خريطة الصفحات الفعلية لا من pageBreakBefore فقط", () => {
    const ref = (id: string) => ({ runs: [{ noteRef: { id, num: 99, kind: "footnote" } }], sectionIndex: 0 });
    const a = ref("1"), b = ref("2"), c = ref("3");
    const model = { section: {}, sections: [{}], noteSettings: { footnote: { start: 3, restart: "eachPage", fmt: "hindiNumbers", position: "pageBottom" }, endnote: { start: 1, restart: "continuous", fmt: "decimal", position: "docEnd" } } } as unknown as Parameters<typeof renumberNoteRefsForPages>[0];
    renumberNoteRefsForPages(model, [[a, b], [c]] as unknown as Parameters<typeof renumberNoteRefsForPages>[1]);
    expect(a.runs[0]!.noteRef.num).toBe(3); expect(b.runs[0]!.noteRef.num).toBe(4);
    expect(c.runs[0]!.noteRef.num).toBe(3); expect(c.runs[0]!.noteRef.fmt).toBe("hindiNumbers");
  });

  it("لا يجعل العلامة المخصصة تزاحم تسلسل الأرقام الآلية", () => {
    const custom = { runs: [{ noteRef: { id: "c", num: 0, kind: "footnote", custom: true, customMark: "(أ)" } }], sectionIndex: 0 };
    const automatic = { runs: [{ noteRef: { id: "1", num: 99, kind: "footnote" } }], sectionIndex: 0 };
    const model = { section: {}, sections: [{}], noteSettings: {
      footnote: { start: 1, restart: "continuous", fmt: "decimal", position: "pageBottom" },
      endnote: { start: 1, restart: "continuous", fmt: "decimal", position: "docEnd" },
    } } as unknown as Parameters<typeof renumberNoteRefsForPages>[0];
    renumberNoteRefsForPages(model, [[custom, automatic]] as unknown as Parameters<typeof renumberNoteRefsForPages>[1]);
    expect(custom.runs[0]!.noteRef.num).toBe(0);
    expect(automatic.runs[0]!.noteRef.num).toBe(1);
  });

  it("لا يكرر العلامة المخصصة إذا كتبها المؤلف في أول متن الحاشية", () => {
    const authored = [{ text: "(1) مجموع الفتاوى" }] as Parameters<typeof noteBodyNeedsMarker>[0];
    const missing = [{ text: "مجموع الفتاوى" }] as Parameters<typeof noteBodyNeedsMarker>[0];
    expect(noteBodyNeedsMarker(authored, "(1)")).toBe(false);
    expect(noteBodyNeedsMarker(missing, "(1)")).toBe(true);
    expect(noteBodyNeedsMarker(authored, null)).toBe(true);
  });

  it("يبقي decimal بأرقام إنجليزية", () => {
    expect(formatNumber("decimal", 12)).toBe("12");
  });

  it("يعرض hindiNumbers وhindiCounting بأرقام عربية", () => {
    expect(formatNumber("hindiNumbers", 12)).toBe("١٢");
    expect(formatNumber("hindiCounting", 203)).toBe("٢٠٣");
  });

  it("يعرض irohaFullWidth وchosung بأبجديتيهما بدل السقوط إلى decimal", () => {
    expect(formatNumber("irohaFullWidth", 1)).toBe("イ");
    expect(formatNumber("irohaFullWidth", 47)).toBe("ス");
    expect(formatNumber("irohaFullWidth", 48)).toBe("イイ");
    expect(formatNumber("chosung", 1)).toBe("ㄱ");
    expect(formatNumber("chosung", 14)).toBe("ㅎ");
    expect(formatNumber("chosung", 15)).toBe("ㄱㄱ");
  });
});

const IBHAJ_NUMBERING = new URL("../../../../../كتب للاختبار/إبهاج أهل الصناعة بدراسة حديث بعثت بالسيف بين يدي الساعة.docx", import.meta.url);
const ARCHIVE_NUMBERING = new URL("../../../../../كتب للاختبار/الأرشيف الجامع لكلمات وخطابات الشيخ أبي مصعب الزرقاوي ـ شبكة البراق الإسلامية.docx", import.meta.url);
const SIYASA_NUMBERING = new URL("../../../../../كتب للاختبار/السياسة الشرعية.. الطبعة الثانية.docx", import.meta.url);
const describeCorpusNumberFormats = [IBHAJ_NUMBERING, ARCHIVE_NUMBERING, SIYASA_NUMBERING].every(url => existsSync(url)) ? describe : describe.skip;
describeCorpusNumberFormats("تنسيقات الترقيم غير اللاتينية في كتب الاختبار", () => {
  it("يحفظ irohaFullWidth وchosung من numbering.xml ويملك المخرج صيغة مرئية لهما", () => {
    const formats = [IBHAJ_NUMBERING, ARCHIVE_NUMBERING, SIYASA_NUMBERING]
      .flatMap(url => [...extractFromDocx(readFileSync(url)).numbering.values()].map(level => level.fmt));
    expect(formats.filter(fmt => fmt === "irohaFullWidth")).toHaveLength(4);
    expect(formats.filter(fmt => fmt === "chosung")).toHaveLength(3);
    expect(formatNumber("irohaFullWidth", 2)).toBe("ロ");
    expect(formatNumber("chosung", 2)).toBe("ㄴ");
  });
});

describe("حقول الصفحة داخل مربعات النص العائمة", () => {
  it("يعرض PAGE المستخرج من Content Control في تذييل توحيد الحاكمية", () => {
    const model = extractFromDocx(readFileSync(TAWHID));
    const footer = headerFooterElement(model, model.section, 2, "footer", newRenderCtx(model), "3", 32, 32, 3);
    expect(footer).not.toBeNull();
    expect((footer as unknown as FakeNode).textContent).toBe("3");
  });

  it("يستبدل PAGE وNUMPAGES دون لمس الكلمات الأخرى", () => {
    expect(replacePageFieldText("(PAGE) من NUMPAGES", "٧", "١٧")).toBe("(٧) من ١٧");
    expect(replacePageFieldText("PAGER", "٧", "١٧")).toBe("PAGER");
    expect(replacePageFieldText("PAGEREF mark", "٧", "١٧", "٣")).toBe("PAGEREF mark");
    expect(replacePageFieldText("SECTIONPAGES / NUMPAGES", "٧", "١٧", "٣")).toBe("٣ / ١٧");
  });

  it("يواصل PAGE عبر مقطع بلا start ويعيده فقط عند start صريح", () => {
    expect(nextDocumentPageNumber(5, 5, 0, {} as Parameters<typeof nextDocumentPageNumber>[3])).toBe(6);
    expect(nextDocumentPageNumber(6, 6, 0, { pgNumStart: 20 } as Parameters<typeof nextDocumentPageNumber>[3])).toBe(20);
  });

  it("يحسب SECTIONPAGES من خريطة الصفحات الفعلية لكل مقطع", () => {
    const p = (sectionIndex: number) => ({ sectionIndex }) as Parameters<typeof pageCountsBySection>[0][number][number];
    expect([...pageCountsBySection([[p(0)], [p(0)], [p(1)], [p(1)], [p(1)]], 1).entries()])
      .toEqual([[0, 2], [1, 3]]);
  });
});

describe("رأس الجدول المتكرر", () => {
  const paragraph = (index: number, row: number, repeatHeader: boolean) => ({
    index, tableCell: { tableId: 4, row, repeatHeader }, text: `r${row}`,
  }) as Parameters<typeof withRepeatedHeaderRows>[0][number];

  it("يضيف صف الرأس بصريًا إلى جزء الجدول في الصفحة التالية", () => {
    const header = paragraph(0, 0, true), continued = paragraph(8, 3, false);
    expect(withRepeatedHeaderRows([continued], [header, continued])).toEqual([header, continued]);
  });

  it("لا يكرر رأسًا غير متتابع من أول الجدول", () => {
    const falseHeader = paragraph(2, 2, true), continued = paragraph(8, 3, false);
    expect(withRepeatedHeaderRows([continued], [falseHeader, continued])).toEqual([continued]);
  });
});

describe("عرض جدول Word", () => {
  it("لا يفرض w:trHeight ذي hRule=auto ويطبق exact/atLeast فقط", () => {
    expect(rowHeightCss(400, "auto")).toBe("");
    expect(rowHeightCss(400, null)).toBe("");
    expect(rowHeightCss(400, "exact")).toBe("height:26.667px");
    expect(rowHeightCss(400, "atLeast")).toBe("min-height:26.667px");
  });
  it("ينقل قرار fixed/autofit إلى تخطيط DOM بدل فرض fixed على كل الجداول", () => {
    const base = { tableId: 1, row: 0, col: 0, colXTwips: 0, colWTwips: 3000, gridSpan: 1,
      totalGridTwips: 3000, bidiVisual: true, tblIndTwips: 0, tblJc: null, tblWVal: 0, tblWType: "auto",
      cantSplit: false, repeatHeader: false, vMerge: null, vAlign: null, textDirection: null,
      rowHeight: null, rowHeightRule: null, marTop: 0, marBottom: 0, marLeft: 0, marRight: 0,
      shdFill: null, tcBorders: null };
    expect(groupTable([{ tableCell: { ...base, tblLayout: "fixed" } }] as unknown as Parameters<typeof groupTable>[0]).tblLayout).toBe("fixed");
    expect(groupTable([{ tableCell: { ...base, tblLayout: "autofit" } }] as unknown as Parameters<typeof groupTable>[0]).tblLayout).toBe("autofit");
  });

  it("يطبق dxa دون تمديد الجدول إلى عرض العمود", () => {
    expect(tableWidthTwips({ available: 9000, grid: 6000, value: 5400, type: "dxa" })).toBe(5400);
  });

  it("يفسر pct بوحدات 1/50 بالمئة", () => {
    expect(tableWidthTwips({ available: 9000, grid: 6000, value: 2500, type: "pct" })).toBe(4500);
  });

  it("يستخدم شبكة الجدول في auto", () => {
    expect(tableWidthTwips({ available: 9000, grid: 6200, value: 0, type: "auto" })).toBe(6200);
  });

  it("يحفظ gridSpan الصريح عند غياب حدود الأعمدة الأخرى من جزء الصفحة", () => {
    const cell = { tableId: 1, row: 0, col: 0, colXTwips: 0, colWTwips: 6000, gridSpan: 3,
      totalGridTwips: 6000, bidiVisual: false, tblIndTwips: 0, tblJc: null, tblWVal: 0, tblWType: "auto",
      cantSplit: false, repeatHeader: false, vMerge: null, vAlign: null, textDirection: null,
      rowHeight: null, rowHeightRule: null, marTop: 0, marBottom: 0, marLeft: 0, marRight: 0,
      shdFill: null, tcBorders: null };
    const data = groupTable([{ tableCell: cell }] as unknown as Parameters<typeof groupTable>[0]);
    expect(data.rows[0]!.cells[0]!.colSpan).toBe(3);
  });

  it("يجمع فقرات الخلية الواحدة داخل td واحد ولا يكرر العمود", () => {
    const cell = { tableId: 1, row: 0, col: 0, colXTwips: 0, colWTwips: 3000, gridSpan: 1,
      totalGridTwips: 3000, bidiVisual: true, tblIndTwips: 0, tblJc: null, tblWVal: 0, tblWType: "auto",
      cantSplit: false, repeatHeader: false, vMerge: null, vAlign: "center", textDirection: null,
      rowHeight: null, rowHeightRule: null, marTop: 0, marBottom: 0, marLeft: 0, marRight: 0,
      shdFill: "FFF2CC", tcBorders: null };
    const paras = [
      { index: 1, text: "الفقرة الأولى", tableCell: cell },
      { index: 2, text: "الفقرة الثانية", tableCell: cell },
    ] as unknown as Parameters<typeof groupTable>[0];
    const data = groupTable(paras);
    expect(data.rows[0]!.cells).toHaveLength(1);
    expect(data.rows[0]!.cells[0]!.paras).toEqual(paras);
  });

  it("يحفظ فقرات خلايا استمرار الدمج العمودي داخل الخلية المدمجة", () => {
    const base = { tableId: 1, col: 0, colXTwips: 0, colWTwips: 3000, gridSpan: 1,
      totalGridTwips: 3000, bidiVisual: true, tblIndTwips: 0, tblJc: null, tblWVal: 0, tblWType: "auto",
      cantSplit: false, repeatHeader: false, vAlign: null, textDirection: null,
      rowHeight: null, rowHeightRule: null, marTop: 0, marBottom: 0, marLeft: 0, marRight: 0,
      shdFill: null, tcBorders: null };
    const paras = [
      { index: 1, text: "البداية", tableCell: { ...base, row: 0, vMerge: "restart" } },
      { index: 2, text: "الاستمرار", tableCell: { ...base, row: 1, vMerge: "continue" } },
    ] as unknown as Parameters<typeof groupTable>[0];
    const data = groupTable(paras);
    expect(data.rows[0]!.cells[0]!.rowSpan).toBe(2);
    expect(data.rows[0]!.cells[0]!.paras).toEqual(paras);
    expect(data.rows[1]!.cells).toHaveLength(0);
  });
});

describe("صفحة الغلاف الخالصة", () => {
  const section = { pageWTwips: 12000, pageHTwips: 17000 } as Parameters<typeof coverAnchorForPage>[1];
  const cover = { extentW: 12100, extentH: 17100, rId: "rCover", inlineFlow: false };

  it("يتعرف الغلاف الكبير عندما لا يوجد متن", () => {
    const paras = [{ excluded: false, text: "", anchors: [cover] }] as Parameters<typeof coverAnchorForPage>[0];
    expect(coverAnchorForPage(paras, section)).toBe(cover);
  });

  it("لا يحول صفحة ذات متن إلى غلاف خالص", () => {
    const paras = [{ excluded: false, text: "عنوان أو متن", anchors: [cover] }] as Parameters<typeof coverAnchorForPage>[0];
    expect(coverAnchorForPage(paras, section)).toBeNull();
  });

  it("يفرض الصورة داخل كامل إطار الورقة", () => {
    const node = new FakeNode("img") as unknown as HTMLElement;
    fillPageWithCover(node, section);
    expect(node.style.left).toBe("0px");
    expect(node.style.top).toBe("0px");
    expect(node.style.width).toBe("800px");
    expect(node.style.height).toBe("1133.333px");
    expect((node as unknown as FakeNode).attrs.get("data-word-cover")).toBe("true");
  });
});

describe("تحويلات مربعات النص", () => {
  it("لا يعكس حروف PAGE أو العربية مع flipH/flipV ويبقي الدوران", () => {
    const textbox = { flipH: true, flipV: true, rotDeg: 90, textBox: [{}] } as Parameters<typeof anchorTransformCss>[0];
    expect(anchorTransformCss(textbox)).toEqual(["rotate(90deg)"]);
  });

  it("يبقي الانعكاس للصورة العادية", () => {
    const picture = { flipH: true, flipV: false, rotDeg: 0 } as Parameters<typeof anchorTransformCss>[0];
    expect(anchorTransformCss(picture)).toEqual(["scaleX(-1)"]);
  });

  it("يرسم صورة حشو مربع النص خلف النص ولا يستبدله بها", () => {
    const model = { partRels: new Map([["header1.xml", new Map([["rBg", "media/bg.png"]])]]),
      relTargets: new Map(), mediaFiles: new Map([["bg.png", new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      ])]])
    } as unknown as Parameters<typeof newRenderCtx>[0];
    const paragraph = { text: "عنوان فوق الصورة", runs: [{ text: "عنوان فوق الصورة", hidden: false }],
      anchors: [], spacing: {}, tabStops: [], ptabAt: [], tabAt: [], bookmarkIds: [], tableCell: null,
    } as unknown as NonNullable<Parameters<typeof anchorToElement>[0]["textBox"]>[number];
    const anchor = { extentW: 2000, extentH: 500, rId: null, part: "header1.xml",
      shape: { prst: "rect", fill: null, stroke: null, strokeW: 0, adj: null },
      shapeFill: { rId: "rBg", mode: "stretch" }, textBox: [paragraph],
    } as Parameters<typeof anchorToElement>[0];
    const node = anchorToElement(anchor, newRenderCtx(model)) as unknown as FakeNode;
    expect(node.children.map(child => child.attrs.get("class"))).toEqual(["flt-textbox-fill", "flt-textbox-content"]);
    expect(node.textContent).toContain("عنوان فوق الصورة");
  });
});

describe("أبناء مجموعة DrawingML", () => {
  it("لا يحذف الشكل النصي الذي لا يحمل صورة", () => {
    const model = { partRels: new Map(), relTargets: new Map(), mediaFiles: new Map() } as unknown as Parameters<typeof newRenderCtx>[0];
    const anchor = { extentW: 3000, extentH: 1800, rId: null, groupChildren: [{
      x: 100, y: 200, w: 1200, h: 500, rId: null, text: "عنوان داخل إطار",
      shape: { prst: "roundRect", fill: "FFF2CC", stroke: "4472C4", strokeW: 20, adj: null },
    }] } as Parameters<typeof anchorToElement>[0];
    const group = anchorToElement(anchor, newRenderCtx(model)) as unknown as FakeNode;
    expect(group.children).toHaveLength(1);
    expect(group.children[0]!.textContent).toBe("عنوان داخل إطار");
    expect(group.children[0]!.attrs.get("data-word-frame")).toBe("roundRect");
  });
});

describe("تحويل EMF المتجهي", () => {
  it("يرسم المستطيل المستدير والقطاع الدائري بدل إسقاطهما", () => {
    const records: Uint8Array[] = [];
    const record = (type: number, values: number[] = []) => {
      const bytes = new Uint8Array(8 + values.length * 4), view = new DataView(bytes.buffer);
      view.setUint32(0, type, true); view.setUint32(4, bytes.length, true);
      values.forEach((value, i) => view.setInt32(8 + i * 4, value, true));
      records.push(bytes);
    };
    const header = new Uint8Array(88), hv = new DataView(header.buffer);
    hv.setUint32(0, 1, true); hv.setUint32(4, 88, true);
    hv.setInt32(16, 200, true); hv.setInt32(20, 200, true); records.push(header);
    record(44, [10, 10, 190, 90, 20, 20]);
    record(47, [20, 100, 180, 190, 180, 145, 100, 100]);
    record(14, [0, 0, 0]);
    const emf = new Uint8Array(records.reduce((n, item) => n + item.length, 0));
    let at = 0; for (const item of records) { emf.set(item, at); at += item.length; }
    const payload = rasterPayload(emf), svg = new TextDecoder().decode(payload!.bytes);
    expect(payload?.mime).toBe("image/svg+xml");
    expect(svg).toContain('rx="10" ry="10"');
    expect(svg).toContain(" A80 45 ");
    expect(svg).toContain(" Z");
  });

  it("يرسم WMF RoundRect القديم كإطار متجهي", () => {
    const wmf = new Uint8Array(18 + 10 + 18 + 6), view = new DataView(wmf.buffer);
    view.setUint16(0, 1, true); view.setUint16(2, 9, true);
    view.setUint32(18, 5, true); view.setUint16(22, 0x020c, true);
    view.setInt16(24, 200, true); view.setInt16(26, 200, true);
    view.setUint32(28, 9, true); view.setUint16(32, 0x061c, true);
    [20, 20, 190, 190, 10, 10].forEach((value, i) => view.setInt16(34 + i * 2, value, true));
    view.setUint32(46, 3, true);
    const payload = rasterPayload(wmf), svg = new TextDecoder().decode(payload!.bytes);
    expect(payload?.mime).toBe("image/svg+xml");
    expect(svg).toContain('rx="10" ry="10"');
  });

  it("يحفظ المسارات المركبة والإغلاق والتعبئة داخل SVG", () => {
    const records: Uint8Array[] = [];
    const record = (type: number, values: number[] = []) => {
      const bytes = new Uint8Array(8 + values.length * 4), view = new DataView(bytes.buffer);
      view.setUint32(0, type, true); view.setUint32(4, bytes.length, true);
      values.forEach((value, i) => view.setInt32(8 + i * 4, value, true));
      records.push(bytes);
    };
    const header = new Uint8Array(88), hv = new DataView(header.buffer);
    hv.setUint32(0, 1, true); hv.setUint32(4, 88, true);
    hv.setInt32(8, 0, true); hv.setInt32(12, 0, true);
    hv.setInt32(16, 100, true); hv.setInt32(20, 100, true);
    records.push(header);
    record(59); record(27, [10, 10]); record(54, [90, 10]);
    record(54, [90, 90]); record(61); record(60);
    record(63, [0, 0, 100, 100]); record(14, [0, 0, 0]);
    const total = records.reduce((n, item) => n + item.length, 0);
    const emf = new Uint8Array(total);
    let at = 0; for (const item of records) { emf.set(item, at); at += item.length; }
    const payload = rasterPayload(emf);
    expect(payload?.mime).toBe("image/svg+xml");
    const svg = new TextDecoder().decode(payload!.bytes);
    expect(svg).toContain('<path d="M10 10 L90 10 L90 90 Z"');
  });

  it("يحوّل سجلات WMF الخطية القديمة إلى SVG", () => {
    const wmf = new Uint8Array(18 + 10 * 3 + 6), view = new DataView(wmf.buffer);
    view.setUint16(0, 1, true); view.setUint16(2, 9, true);
    const record = (at: number, fn: number, a = 0, b = 0) => {
      view.setUint32(at, 5, true); view.setUint16(at + 4, fn, true);
      view.setInt16(at + 6, a, true); view.setInt16(at + 8, b, true);
    };
    record(18, 0x020c, 100, 100);
    record(28, 0x0214, 10, 10);
    record(38, 0x0213, 90, 90);
    view.setUint32(48, 3, true);
    const payload = rasterPayload(wmf);
    expect(payload?.mime).toBe("image/svg+xml");
    expect(new TextDecoder().decode(payload!.bytes)).toContain('x1="10" y1="10" x2="90" y2="90"');
  });

  it("يحفظ نصوص EMF Unicode داخل SVG", () => {
    const header = new Uint8Array(88), hv = new DataView(header.buffer);
    hv.setUint32(0, 1, true); hv.setUint32(4, 88, true);
    hv.setInt32(16, 100, true); hv.setInt32(20, 100, true);
    const textRecord = new Uint8Array(80), tv = new DataView(textRecord.buffer);
    tv.setUint32(0, 84, true); tv.setUint32(4, 80, true);
    tv.setInt32(36, 12, true); tv.setInt32(40, 34, true);
    tv.setUint32(44, 2, true); tv.setUint32(48, 76, true);
    textRecord.set(new TextEncoder().encode("AB"), 76);
    // UTF-16LE: نثبت البايتات صراحةً لأن TextEncoder يخرج UTF-8 فقط.
    textRecord.set([0x41, 0, 0x42, 0], 76);
    const emf = new Uint8Array(168); emf.set(header); emf.set(textRecord, 88);
    const payload = rasterPayload(emf);
    expect(payload?.mime).toBe("image/svg+xml");
    expect(new TextDecoder().decode(payload!.bytes)).toContain('<text x="12" y="34"');
    expect(new TextDecoder().decode(payload!.bytes)).toContain(">AB</text>");
  });

  it("يحوّل EMR_GRADIENTFILL الأفقي إلى تدرج SVG حقيقي", () => {
    const header = new Uint8Array(88), hv = new DataView(header.buffer);
    hv.setUint32(0, 1, true); hv.setUint32(4, 88, true);
    hv.setInt32(16, 200, true); hv.setInt32(20, 100, true);
    const gradient = new Uint8Array(76), gv = new DataView(gradient.buffer);
    gv.setUint32(0, 118, true); gv.setUint32(4, 76, true);
    gv.setUint32(24, 2, true); gv.setUint32(28, 1, true); gv.setUint32(32, 0, true);
    // TRIVERTEX: x,y ثم COLOR16 الأحمر/الأخضر/الأزرق/ألفا.
    gv.setInt32(36, 10, true); gv.setInt32(40, 20, true); gv.setUint16(44, 0xffff, true);
    gv.setInt32(52, 190, true); gv.setInt32(56, 80, true); gv.setUint16(64, 0xffff, true);
    gv.setUint32(68, 0, true); gv.setUint32(72, 1, true);
    const emf = new Uint8Array(164); emf.set(header); emf.set(gradient, 88);
    const svg = new TextDecoder().decode(rasterPayload(emf)!.bytes);
    expect(svg).toContain('<linearGradient id="emfGradient0" x1="0%" y1="0%" x2="100%" y2="0%">');
    expect(svg).toContain('<stop offset="0%" stop-color="#ff0000"');
    expect(svg).toContain('<stop offset="100%" stop-color="#0000ff"');
    expect(svg).toContain('fill="url(#emfGradient0)"');
  });

  it("يحفظ META_EXTTEXTOUT في WMF مع مصفوفة تباعد الحروف", () => {
    const recordBytes = 28, wmf = new Uint8Array(18 + 10 + recordBytes + 6), view = new DataView(wmf.buffer);
    view.setUint16(0, 1, true); view.setUint16(2, 9, true);
    view.setUint32(18, 5, true); view.setUint16(22, 0x020c, true);
    view.setInt16(24, 100, true); view.setInt16(26, 200, true);
    view.setUint32(28, recordBytes / 2, true); view.setUint16(32, 0x0a32, true);
    view.setInt16(34, 30, true); view.setInt16(36, 12, true);
    view.setUint16(38, 3, true); view.setUint16(40, 0, true);
    wmf.set([0x41, 0x42, 0x43, 0], 42);
    view.setInt16(46, 8, true); view.setInt16(48, 9, true); view.setInt16(50, 10, true);
    view.setUint32(56, 3, true);
    const svg = new TextDecoder().decode(rasterPayload(wmf)!.bytes);
    expect(svg).toContain('<text x="12" y="30"');
    expect(svg).toContain('<tspan x="12">A</tspan><tspan x="20">B</tspan><tspan x="29">C</tspan>');
  });
});

describe("ooxml-dom — عينة masjid", () => {
  const model = extractFromDocx(readFileSync(new URL("../../../corpus/books/sample-masjid.docx", import.meta.url)));

  it("يخرج صفحاتٍ بعدد كسور الصفحة + 1", () => {
    const doc = renderDocument(model) as unknown as FakeNode;
    const pages = doc.children.filter((c) => (c.attrs.get("class") ?? "").split(/\s+/).includes("page"));
    expect(pages.length).toBe(groupPages(model).length);
    expect(pages.length).toBeGreaterThan(0);
  });

  it("كل صفحةٍ تحمل هندستها وتحتوي فقراتٍ نصية", () => {
    const doc = renderDocument(model) as unknown as FakeNode;
    const pages = doc.children.filter((c) => (c.attrs.get("class") ?? "").split(/\s+/).includes("page"));
    const first = pages[0]!;
    expect(first.attrs.get("style")).toContain("padding:");
    expect(first.children.some((c) => c.attrs.get("class") === "page-body")).toBe(true);
  });

  it("النص الممتد عبر الفقرات يحوي عربيةً مألوفة", () => {
    const doc = renderDocument(model) as unknown as FakeNode;
    const pages = doc.children.filter((c) => (c.attrs.get("class") ?? "").split(/\s+/).includes("page"));
    const allText = pages.map((p) => p.textContent).join("\n");
    // سطرٌ فعلي من المتن — لا نكسر على نصوص محددة بل على كثافة عربية
    const arabic = (allText.match(/[\u0600-\u06FF]/g) ?? []).length;
    expect(arabic).toBeGreaterThan(50);
  });
});

describe("ooxml-dom — عينة أحاديث (فهرسٌ مقسّم بالصفحات)", () => {
  const model = extractFromDocx(readFileSync(new URL("../../../corpus/books/sample-ahadith.docx", import.meta.url)));

  it("عدد الصفحات = عدد pageBreakBefore + 1 (لا تُسقط علامات)", () => {
    const breaks = model.paragraphs.filter((p) => p.pageBreakBefore).length;
    const doc = renderDocument(model) as unknown as FakeNode;
    const pages = doc.children.filter((c) => (c.attrs.get("class") ?? "").split(/\s+/).includes("page"));
    expect(pages.length).toBe(breaks + 1);
  });

  it("يستبدل حقل PAGE برقم الصفحة الأصلي داخل المقطع", () => {
    expect(pageNumberText({ ...model.section, pgNumStart: 4 }, 0)).toBe("4");
    expect(pageNumberText({ ...model.section, pgNumStart: 4 }, 1)).toBe("5");
    expect(pageNumberText({ ...model.section, pgNumFmt: "thaiNumbers", pgNumStart: 1 }, 0)).toBe("๑");
    expect(pageNumberText({ ...model.section, pgNumFmt: "thaiNumbers", pgNumStart: 1 }, 1)).toBe("๒");
  });

  it("لا يترك كلمة PAGE الحقلية ظاهرة في تذييل الصفحات", () => {
    const doc = renderDocument(model) as unknown as FakeNode;
    expect(doc.textContent).not.toContain("PAGE");
    expect(doc.textContent).toContain("(1)");
  });
});
