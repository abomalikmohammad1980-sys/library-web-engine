import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { deobfuscateEmbeddedFont, extractFromDocx, mathPlainText, openDocx, pageFieldKind, parseChart, parseDocument, parseNotes, parseNumbering, parseStyles, parseTheme, relativeSize, styleRefField } from "./index.js";

const OFFICEDEV_TEMPLATE = new URL("../../../tmp/Word external QA/OfficeDev-ImportTemplate/template-example.docx", import.meta.url);
const OPENXML_BACKGROUND = new URL("../../../tmp/Word external QA/OpenXmlSdk-DocumentBackground/document-background.docx", import.meta.url);
const OPENXML_SECTION_BREAK = new URL("../../../tmp/Word external QA/OpenXmlSdk-SectionBreak/section-break.docx", import.meta.url);
const OPENXML_COLUMNS1 = new URL("../../../tmp/Word external QA/OpenXmlSdk-Columns1/columns1.docx", import.meta.url);
const OPENXML_TABLE_CELL_2_PARA = new URL("../../../tmp/Word external QA/OpenXmlSdk-TableCell2Para/table-cell-2-para.docx", import.meta.url);
const OPENXML_COMPLEX_TABLE = new URL("../../../tmp/Word external QA/OpenXmlSdk-ComplexTable/complex-table.docx", import.meta.url);
const OPENXML_GREETING_LINE = new URL("../../../tmp/Word external QA/OpenXmlSdk-GreetingLine/greeting-line.docx", import.meta.url);
const OPENXML_HYPERLINK_TABLE = new URL("../../../tmp/Word external QA/OpenXmlSdk-HyperlinkInTable/hyperlink-in-table.docx", import.meta.url);

describe.runIf(existsSync(OPENXML_GREETING_LINE))("Open XML SDK — cached field result", () => {
  it("يحفظ نتيجة GREETINGLINE المرئية ولا يقصي فقرتها كتعليمة حقل", () => {
    const model = extractFromDocx(readFileSync(OPENXML_GREETING_LINE));
    expect(model.paragraphs).toHaveLength(1);
    expect(model.paragraphs[0]).toMatchObject({ text: "«GreetingLine»", excluded: false });
    expect(model.paragraphs[0]!.runs.map(run => run.text).join("")).toBe("«GreetingLine»");
  });
});
const USUS_NOTES = new URL("../../../../../كتب للاختبار/أُسس قوام الشخصية الفاعلة.. شرح سورة الشرح.docx", import.meta.url);

describe.runIf(existsSync(USUS_NOTES))("corpus — حواشٍ متعددة الفقرات", () => {
  it("يحفظ فقرات الحاشية 18 وقصتي الفصل المحجوزتين دون خلطها بالمراجع", () => {
    const model = extractFromDocx(readFileSync(USUS_NOTES));
    expect(model.footnotes.get("18")).toHaveLength(2);
    expect(model.footnotes.get("18")?.map(paragraph => paragraph.text)).toEqual([
      expect.stringContaining("صحيح البخاري"),
      expect.stringContaining("صحيح مسلم"),
    ]);
    expect(model.footnotes.has("-1")).toBe(true);
    expect(model.footnotes.has("0")).toBe(true);
    expect(model.endnotes.has("-1")).toBe(true);
    expect(model.endnotes.has("0")).toBe(true);
    expect(model.paragraphs.flatMap(paragraph => paragraph.runs)
      .filter(run => run.noteRef?.kind === "endnote")).toHaveLength(0);
  });
});

describe("OfficeDev import-template — inline WPS", () => {
  it.runIf(existsSync(OFFICEDEV_TEMPLATE))("يحفظ Rectangle 78 ونص LOGO السطريين", () => {
    const model = extractFromDocx(readFileSync(OFFICEDEV_TEMPLATE));
    const logo = model.paragraphs.flatMap(paragraph => paragraph.anchors)
      .find(anchor => anchor.inlineFlow && anchor.textBox?.some(paragraph => paragraph.text === "LOGO"));
    expect(logo).toMatchObject({ extentW: 4202, extentH: 647, inlineFlow: true,
      rId: null, shape: { prst: "rect", fill: null, strokeW: 40 },
      boxAnchor: "b", boxIns: { l: 144, r: 144, t: 72, b: 72 } });
    expect(logo?.shape?.stroke).toMatch(/^[0-9A-F]{6}$/);
  });
});

describe("Open XML SDK — document background", () => {
  it.runIf(existsSync(OPENXML_BACKGROUND))("يحفظ RGB الصريح لخلفية الصفحة الرسمية", () => {
    const model = extractFromDocx(readFileSync(OPENXML_BACKGROUND));
    expect(model.pageBackground).toBe("548DD4");
    expect(model.section.pageBorders?.top?.color).toBe("17365D");
  });
});

describe("Open XML SDK — section break ownership", () => {
  it.runIf(existsSync(OPENXML_SECTION_BREAK))("يأخذ continuous من sectPr المقطع التالي دون إضافة كسر إلى العلامة المحفوظة", () => {
    const model = extractFromDocx(readFileSync(OPENXML_SECTION_BREAK));
    expect(model.sections).toHaveLength(2);
    expect(model.sections[0]!.sectStart).toBe("nextPage");
    expect(model.sections[1]!.sectStart).toBe("continuous");
    const second = model.paragraphs.find(paragraph => paragraph.sectionIndex === 1);
    // The official source contains one stale lastRenderedPageBreak. A continuous
    // section must not add another break on top of that saved-layout marker.
    expect(second?.pageBreaksBefore).toBe(1);
    expect(second?.pageBreakBefore).toBe(true);
  });

  it("ينسب نوع الحد إلى sectPr المقطع الداخل إليه", () => {
    const document = (nextType: "continuous" | "nextPage") => parseDocument(
      `<w:document xmlns:w="w"><w:body>
        <w:p><w:pPr><w:sectPr/></w:pPr><w:r><w:t>المقطع الأول</w:t></w:r></w:p>
        <w:p><w:r><w:t>المقطع الثاني</w:t></w:r></w:p>
        <w:sectPr><w:type w:val="${nextType}"/></w:sectPr>
      </w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));

    const continuous = document("continuous");
    expect(continuous.paragraphs.find(paragraph => paragraph.sectionIndex === 1))
      .toMatchObject({ text: "المقطع الثاني", pageBreaksBefore: 0, pageBreakBefore: false });

    const nextPage = document("nextPage");
    expect(nextPage.paragraphs.find(paragraph => paragraph.sectionIndex === 1))
      .toMatchObject({ text: "المقطع الثاني", pageBreaksBefore: 1, pageBreakBefore: true });
  });
});

describe("Open XML SDK — explicit unequal columns", () => {
  it.runIf(existsSync(OPENXML_COLUMNS1))("يحفظ عرض ومسافة كل عمود كما يصرح الملف الرسمي", () => {
    const model = extractFromDocx(readFileSync(OPENXML_COLUMNS1));
    expect(model.sections).toHaveLength(8);
    expect(model.sections[4]!.explicitColumns).toEqual([
      { widthTwips: 5399, spaceAfterTwips: 425 },
      { widthTwips: 2487, spaceAfterTwips: 425 },
    ]);
    expect(model.sections[6]!.explicitColumns).toEqual([
      { widthTwips: 2487, spaceAfterTwips: 425 },
      { widthTwips: 5399, spaceAfterTwips: 425 },
    ]);
  });
});

describe("Open XML SDK — multiple paragraphs per table cell", () => {
  it.runIf(existsSync(OPENXML_TABLE_CELL_2_PARA))("يحفظ فقرتي الخلية الأولى في الخلية نفسها وبترتيبهما", () => {
    const model = extractFromDocx(readFileSync(OPENXML_TABLE_CELL_2_PARA));
    const firstCell = model.paragraphs.filter(paragraph =>
      paragraph.tableCell?.tableId === 0 && paragraph.tableCell.row === 0 && paragraph.tableCell.col === 0);
    expect(firstCell.map(paragraph => paragraph.text)).toEqual([
      "Paragraph inside a table cell", "Para2 inside a table cell",
    ]);
    expect(firstCell.map(paragraph => paragraph.tableCell?.firstInCell)).toEqual([true, false]);
  });
});

describe("Open XML SDK — nested table ownership", () => {
  it.runIf(existsSync(OPENXML_HYPERLINK_TABLE))("يحفظ ملكية الجدول الداخلي ورابطه في العينة الرسمية", () => {
    const model = extractFromDocx(readFileSync(OPENXML_HYPERLINK_TABLE));
    const nested = model.paragraphs.filter(paragraph => paragraph.tableCell?.parentTableId === 0);
    expect(nested[0]?.tableCell).toMatchObject({
      tableId: 1, parentTableId: 0, parentRow: 0, parentCol: 0, nestingDepth: 1,
    });
    expect(nested.flatMap(paragraph => paragraph.runs)
      .some(run => run.href === "http://www.ecma.org/")).toBe(true);
  });

  it.runIf(existsSync(OPENXML_COMPLEX_TABLE))("يحفظ سلسلة parent-cell في الجدول الرسمي العميق", () => {
    const model = extractFromDocx(readFileSync(OPENXML_COMPLEX_TABLE));
    const tables = new Map<number, NonNullable<(typeof model.paragraphs)[number]["tableCell"]>>();
    for (const paragraph of model.paragraphs) if (paragraph.tableCell && !tables.has(paragraph.tableCell.tableId))
      tables.set(paragraph.tableCell.tableId, paragraph.tableCell);
    expect(tables).toHaveLength(8);
    expect(tables.get(0)).toMatchObject({ nestingDepth: 0 });
    expect(tables.get(0)?.parentTableId).toBeUndefined();
    for (let id = 1; id < 8; id++) expect(tables.get(id)).toMatchObject({
      parentTableId: id - 1, parentRow: 0, parentCol: 0, nestingDepth: id,
    });
  });

  it("يرفض تعشيشًا يتجاوز 16 مستوى بدل استنزاف المكدس", () => {
    let inner = '<w:p><w:r><w:t>نهاية</w:t></w:r></w:p>';
    for (let i = 0; i < 17; i++) inner = `<w:tbl><w:tblGrid><w:gridCol w:w="100"/></w:tblGrid>
      <w:tr><w:tc>${inner}<w:p/></w:tc></w:tr></w:tbl>`;
    expect(() => parseDocument(`<w:document xmlns:w="w"><w:body>${inner}<w:sectPr/></w:body></w:document>`,
      parseStyles('<w:styles xmlns:w="w"/>'))).toThrow(/تعشيش الجداول.*16/);
  });

  it("يحفظ ترتيب text/table/text/table داخل الخلية", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:tbl>
      <w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc>
      <w:p><w:r><w:t>A</w:t></w:r></w:p>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>C</w:t></w:r></w:p>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>D</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>E</w:t></w:r></w:p>
      </w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs.filter(p => p.tableCell?.tableId === 0)
      .map(p => [p.text, p.tableCell?.cellBlockIndex])).toEqual([["A", 0], ["C", 2], ["E", 4]]);
    expect(model.paragraphs.find(p => p.tableCell?.tableId === 1)?.tableCell)
      .toMatchObject({ parentTableId: 0, parentBlockIndex: 1 });
    expect(model.paragraphs.find(p => p.tableCell?.tableId === 2)?.tableCell)
      .toMatchObject({ parentTableId: 0, parentBlockIndex: 3 });
  });

  it("يبقي sdtContent الشفاف على عداد كتل الخلية نفسه", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:tbl>
      <w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc>
      <w:p><w:r><w:t>A</w:t></w:r></w:p><w:sdt><w:sdtContent>
      <w:tbl><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>C</w:t></w:r></w:p></w:sdtContent></w:sdt>
      <w:p><w:r><w:t>D</w:t></w:r></w:p>
      </w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs.filter(p => p.tableCell?.tableId === 0)
      .map(p => [p.text, p.tableCell?.cellBlockIndex])).toEqual([["A", 0], ["C", 2], ["D", 3]]);
    expect(model.paragraphs.find(p => p.tableCell?.tableId === 1)?.tableCell)
      .toMatchObject({ parentTableId: 0, parentBlockIndex: 1 });
  });
});

describe("OOXML chart cache", () => {
  it("يحل clustered column من cache ولا يختلق نوعًا غير مدعوم", () => {
    const theme = new Map([["accent6", "70AD47"]]);
    const chart = parseChart(`<c:chartSpace xmlns:c="c" xmlns:a="a"><c:chart><c:plotArea>
      <c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser>
      <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>سلسلة</c:v></c:pt></c:strCache></c:strRef></c:tx>
      <c:spPr><a:solidFill><a:schemeClr val="accent6"><a:lumMod val="50000"/></a:schemeClr></a:solidFill></c:spPr>
      <c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>فئة</c:v></c:pt></c:strCache></c:strRef></c:cat>
      <c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>4.3</c:v></c:pt></c:numCache></c:numRef></c:val>
      <c:dLbls><c:showVal val="1"/></c:dLbls></c:ser></c:barChart><c:catAx/><c:valAx/>
      </c:plotArea><c:legend><c:legendPos val="t"/></c:legend></c:chart></c:chartSpace>`, theme);
    expect(chart).toMatchObject({ kind: "bar", direction: "column", grouping: "clustered",
      categories: ["فئة"], showValues: true, categoryAxis: true, valueAxis: true,
      legend: { visible: true, position: "t" },
      series: [{ name: "سلسلة", values: [4.3], color: "385724" }] });
    expect(parseChart(`<c:chartSpace xmlns:c="c"><c:chart><c:plotArea><c:pieChart/>
      </c:plotArea></c:chart></c:chartSpace>`, theme)).toMatchObject({
      kind: "unsupported", unsupportedType: "pieChart", series: [], categories: [],
    });
  });
  const official = new URL("../../../tmp/Word external QA/OfficeDev-SampleDoc/SampleDoc.docx", import.meta.url);
  it.runIf(existsSync(official))("يستخرج chart الرسمي من علاقته وcache المضمّن", () => {
    const chart = extractFromDocx(readFileSync(official)).paragraphs
      .flatMap(paragraph => paragraph.anchors).find(anchor => anchor.chart)?.chart;
    expect(chart).toMatchObject({ kind: "bar", direction: "column", grouping: "clustered",
      categories: ["Category 1", "Category 2"], showValues: true,
      legend: { visible: true, position: "t" },
      series: [{ name: "Series 1", values: [4.3, 2.5], color: "385724" },
        { name: "Series 2", values: [2.4, 4.4], color: "2E47B1" }] });
  });
});

describe("هندسة قص الصورة السطرية", () => {
  it("يحفظ pic:spPr/a:prstGeom للصورة بدل إسقاط القص البيضاوي", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:wp="wp" xmlns:a="a"
      xmlns:pic="pic" xmlns:r="r"><w:body><w:p><w:r><w:drawing><wp:inline>
      <wp:extent cx="635000" cy="635000"/><wp:docPr id="1" name="Oval"/>
      <a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId1"/></pic:blipFill>
      <pic:spPr><a:prstGeom prst="ellipse"/></pic:spPr></pic:pic></a:graphicData></a:graphic>
      </wp:inline></w:drawing></w:r></w:p><w:sectPr/></w:body></w:document>`,
      parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]!.anchors[0]!.shape?.prst).toBe("ellipse");
    expect(model.paragraphs[0]!.anchors[0]!.rId).toBe("rId1");
  });
});

describe("فواصل أعمدة Word", () => {
  it("يحفظ موضع w:br type=column داخل الرن والفقرة", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>قبل</w:t>
      <w:br w:type="column"/><w:t>بعد</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`,
      parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]!.text).toBe("قبل\nبعد");
    expect(model.paragraphs[0]!.columnBreak).toBe(true);
    expect(model.paragraphs[0]!.columnBreakAt).toEqual([3]);
  });
});

describe("وراثة snapToGrid", () => {
  it("يرث تعطيل الشبكة من docDefaults ويتيح للمباشر إعادة تفعيله", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:docDefaults><w:pPrDefault><w:pPr>
      <w:snapToGrid w:val="0"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body>
      <w:p><w:r><w:t>موروث</w:t></w:r></w:p>
      <w:p><w:pPr><w:snapToGrid w:val="1"/></w:pPr><w:r><w:t>مباشر</w:t></w:r></w:p>
      <w:sectPr><w:docGrid w:type="lines" w:linePitch="360"/></w:sectPr>
      </w:body></w:document>`, styles);
    expect(model.paragraphs.map(paragraph => paragraph.snapToGrid)).toEqual([false, true]);
  });
});

describe("ظل Word القديم", () => {
  it("يرث w:shadow ويحسب إزاحته من حجم الخط مع احترام الإبطال المباشر", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="s">
      <w:rPr><w:sz w:val="48"/><w:shadow/></w:rPr></w:style></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="s"/></w:pPr>
      <w:r><w:t>ظل</w:t></w:r>
      <w:r><w:rPr><w:shadow w:val="0"/></w:rPr><w:t>عادي</w:t></w:r>
      </w:p><w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs[0]!.runs[0]!.textShadow).toEqual({
      xTwips: 20, yTwips: 20, blurTwips: 0, color: "C0C0C0", opacity: 1,
    });
    expect(model.paragraphs[0]!.runs[1]!.textShadow).toBeUndefined();
  });
});

const ARCHIVE_SHADOW = new URL("../../../../../كتب للاختبار/الأرشيف الجامع لكلمات وخطابات الشيخ أبي مصعب الزرقاوي ـ شبكة البراق الإسلامية.docx", import.meta.url);
const describeArchiveShadow = existsSync(ARCHIVE_SHADOW) ? describe : describe.skip;
describeArchiveShadow("انحدار w:shadow في الأرشيف الجامع", () => {
  const model = extractFromDocx(readFileSync(ARCHIVE_SHADOW));
  it("يحفظ مئات الظلال القديمة بالقيمة المقاسة بدل إسقاطها", () => {
    const shadowed = model.paragraphs.flatMap(paragraph => paragraph.runs)
      .filter(run => run.textShadow?.color === "C0C0C0" && run.textShadow.blurTwips === 0);
    expect(shadowed.length).toBeGreaterThan(200);
    for (const run of shadowed.slice(0, 20)) {
      expect(run.textShadow!.xTwips).toBeCloseTo((run.emTwips ?? 0) / 24, 6);
      expect(run.textShadow!.yTwips).toBeCloseTo((run.emTwips ?? 0) / 24, 6);
    }
  });
});

describe("تباعد Word التلقائي", () => {
  it("يحسم Auto إلى 5pt المقاسة ويحترم الإبطال المباشر", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="auto"><w:pPr><w:spacing w:beforeAutospacing="1" w:afterAutospacing="1"/></w:pPr></w:style></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body>
      <w:p><w:pPr><w:pStyle w:val="auto"/></w:pPr><w:r><w:t>موروث</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="auto"/><w:spacing w:beforeAutospacing="0" w:before="240"/></w:pPr><w:r><w:t>مباشر</w:t></w:r></w:p>
      <w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs[0]!.spacing).toMatchObject({ before: 100, after: 100,
      beforeAuto: true, afterAuto: true });
    expect(model.paragraphs[1]!.spacing).toMatchObject({ before: 240, after: 100,
      beforeAuto: false, afterAuto: true });
  });
});

describe("Word OMML equations", () => {
  it("يحفظ ترتيب المعادلة والكسور والأسس والجذر ضمن رن دلالي قابل للبحث", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:m="m"><w:body><w:p>
      <w:r><w:t>قبل </w:t></w:r><m:oMath><m:f><m:num><m:r><m:t>x</m:t></m:r></m:num>
      <m:den><m:sSup><m:e><m:r><m:t>y</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:den></m:f></m:oMath>
      <w:r><w:t> بعد</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const paragraph = model.paragraphs[0]!;
    expect(paragraph.runs).toHaveLength(3);
    expect(paragraph.text).toBe("قبل (x)/(y^2) بعد");
    expect(paragraph.runs[1]!.math?.kind).toBe("fraction");
    expect(mathPlainText(paragraph.runs[1]!.math!)).toBe("(x)/(y^2)");
  });

  it("يحفظ n-ary والعلامات والدوال والحدود كعقد دلالية", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:m="m"><w:body><w:p><m:oMath>
      <m:nary><m:naryPr><m:chr m:val="∑"/><m:limLoc m:val="undOvr"/></m:naryPr>
        <m:sub><m:r><m:t>i=0</m:t></m:r></m:sub><m:sup><m:r><m:t>n</m:t></m:r></m:sup><m:e><m:r><m:t>x</m:t></m:r></m:e></m:nary>
      <m:acc><m:accPr><m:chr m:val="̂"/></m:accPr><m:e><m:r><m:t>y</m:t></m:r></m:e></m:acc>
      <m:bar><m:barPr><m:pos m:val="bot"/></m:barPr><m:e><m:r><m:t>z</m:t></m:r></m:e></m:bar>
      <m:func><m:fName><m:r><m:t>sin</m:t></m:r></m:fName><m:e><m:r><m:t>t</m:t></m:r></m:e></m:func>
      <m:limLow><m:e><m:r><m:t>lim</m:t></m:r></m:e><m:lim><m:r><m:t>x→0</m:t></m:r></m:lim></m:limLow>
    </m:oMath></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const math = model.paragraphs[0]!.runs[0]!.math!;
    expect(math.kind).toBe("row");
    expect((math as Extract<typeof math, { kind: "row" }>).children.map(node => node.kind))
      .toEqual(["nary", "accent", "accent", "function", "limit"]);
    expect(mathPlainText(math)).toBe("∑_i=0^nxover(y,̂)under(z,_)sin(t)lim_x→0");
  });
});

describe("Word page fields", () => {
  it("يميز PAGE وNUMPAGES وSECTIONPAGES عن PAGEREF باسم الحقل الكامل", () => {
    expect(pageFieldKind(" PAGE  \\* MERGEFORMAT ")).toBe("PAGE");
    expect(pageFieldKind("NUMPAGES \\* Arabic")).toBe("NUMPAGES");
    expect(pageFieldKind("SECTIONPAGES")).toBe("SECTIONPAGES");
    expect(pageFieldKind("PAGEREF _Toc123 \\h")).toBeNull();
  });

  it("يعبر عنصر تحكم المحتوى block ولا يسقط PAGE الملفوف داخله", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:sdt><w:sdtPr/>
      <w:sdtContent><w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText> PAGE \\* MERGEFORMAT </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>3</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:sdtContent></w:sdt>
      <w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs).toHaveLength(1);
    expect(model.paragraphs[0]!.runs.some(run => run.fieldResult === "PAGE")).toBe(true);
  });

  it("يحفظ الرنّات والحقول داخل inline content control بموضعها", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p>
      <w:r><w:t>قبل </w:t></w:r><w:sdt><w:sdtPr/><w:sdtContent>
      <w:r><w:t>قيمة </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>32</w:t></w:r></w:fldSimple>
      </w:sdtContent></w:sdt><w:r><w:t> بعد</w:t></w:r></w:p>
      <w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]!.text).toBe("قبل قيمة 32 بعد");
    expect(model.paragraphs[0]!.runs.find(run => run.text === "32")?.fieldResult).toBe("NUMPAGES");
  });

  it("يوسم نتائج الحقول المركبة وfldSimple ولا يوسم PAGEREF", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> SECTION</w:instrText></w:r>
      <w:r><w:instrText>PAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>3</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:fldSimple w:instr=" NUMPAGES \\* MERGEFORMAT"><w:r><w:t>9</w:t></w:r></w:fldSimple>
      <w:fldSimple w:instr=" PAGEREF mark \\h"><w:r><w:t>7</w:t></w:r></w:fldSimple>
    </w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const results = model.paragraphs[0]!.runs.filter(run => run.text === "3" || run.text === "9" || run.text === "7");
    expect(results.map(run => run.fieldResult)).toEqual(["SECTIONPAGES", "NUMPAGES", null]);
  });
});

describe("محاذاة علامة القائمة", () => {
  it("يحفظ w:lvlJc الفيزيائي في مستوى الترقيم", () => {
    const numbering = parseNumbering(`<w:numbering xmlns:w="w"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="right"/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/></w:num></w:numbering>`);
    expect(numbering.get("7/0")?.jc).toBe("right");
  });
  it("يحفظ خط ASCII لعلامة القائمة قبل خط cs", () => {
    const numbering = parseNumbering(`<w:numbering xmlns:w="w"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val=""/><w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings" w:cs="Traditional Arabic"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/></w:num></w:numbering>`);
    expect(numbering.get("7/0")?.markerFamily).toBe("Wingdings");
  });
  it("يحفظ غامق وتسطير ولون علامة القائمة", () => {
    const numbering = parseNumbering(`<w:numbering xmlns:w="w"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:rPr><w:b/><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/></w:num></w:numbering>`);
    expect(numbering.get("7/0")).toMatchObject({ markerBold: true, markerUnderline: "single", markerColor: "0000FF" });
  });
  it("يطبق startOverride على numId دون تغيير abstractNum المشترك", () => {
    const numbering = parseNumbering(`<w:numbering xmlns:w="w"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="5"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num><w:num w:numId="8"><w:abstractNumId w:val="1"/></w:num></w:numbering>`);
    expect(numbering.get("7/0")?.start).toBe(1);
    expect(numbering.get("8/0")?.start).toBe(5);
  });
});

describe("تعطيل الفصل الآلي", () => {
  it("يورث w:suppressAutoHyphens من نمط الفقرة", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="nohy"><w:pPr><w:suppressAutoHyphens/></w:pPr></w:style></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="nohy"/></w:pPr><w:r><w:t>hyphenation</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs[0]?.suppressAutoHyphens).toBe(true);
  });
});

describe("مستوى outline للفقرة", () => {
  it("يورث w:outlineLvl من نمط الفقرة ويقبل body level 9", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="h"><w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="h"/></w:pPr><w:r><w:t>عنوان</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="h"/><w:outlineLvl w:val="9"/></w:pPr><w:r><w:t>متن</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs.map(p => p.outlineLevel)).toEqual([2, 9]);
  });
});

describe("عقود إبقاء الفقرة", () => {
  it("يورث keepNext وkeepLines ويحترم الإبطال المباشر", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="k"><w:pPr><w:keepNext/><w:keepLines/></w:pPr></w:style></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="k"/></w:pPr><w:r><w:t>أ</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="k"/><w:keepNext w:val="0"/></w:pPr><w:r><w:t>ب</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs[0]).toMatchObject({ keepNext: true, keepLines: true });
    expect(model.paragraphs[1]).toMatchObject({ keepNext: false, keepLines: true });
  });
  it("يورث contextualSpacing ويحترم الإبطال المباشر", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="ctx"><w:pPr><w:contextualSpacing/></w:pPr></w:style></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="ctx"/></w:pPr><w:r><w:t>أ</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="ctx"/><w:contextualSpacing w:val="0"/></w:pPr><w:r><w:t>ب</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs[0]!.contextualSpacing).toBe(true);
    expect(model.paragraphs[1]!.contextualSpacing).toBe(false);
  });
  it("يورث widowControl=0 بدل إعادة الافتراضي true", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="w"><w:pPr><w:widowControl w:val="0"/></w:pPr></w:style></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="w"/></w:pPr><w:r><w:t>نص</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs[0]?.widowControl).toBe(false);
  });
});

describe("نص المصدر للخطوط الرمزية", () => {
  it("يفك XOR لأول 32 بايت من خط OOXML المضمن دون تغيير الذيل", () => {
    const original = Uint8Array.from({ length: 48 }, (_, i) => i);
    const key = "{00112233-4455-6677-8899-AABBCCDDEEFF}";
    const obfuscated = deobfuscateEmbeddedFont(original, key);
    const restored = deobfuscateEmbeddedFont(obfuscated, key);
    expect(restored).toEqual(original);
    expect(obfuscated.slice(32)).toEqual(original.slice(32));
    expect(obfuscated.slice(0, 32)).not.toEqual(original.slice(0, 32));
  });

  it("يحفظ مقياس عرض المحارف w:w بوصفه نسبة مئوية", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:r><w:rPr><w:w w:val="36"/></w:rPr><w:t>عنوان مضغوط</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.runs[0]?.charScale).toBe(36);
  });

  it("يحفظ طلب w14:ligatures القياسي والسياقي", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:w14="w14"><w:body><w:p><w:r><w:rPr><w14:ligatures w14:val="standardContextual"/></w:rPr><w:t>office</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.runs[0]?.ligatures).toBe("standardContextual");
  });

  it("يدمج لغات w:lang المستقلة عبر سلسلة rPr", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="s"><w:rPr><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:style></w:styles>`);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="s"/></w:pPr><w:r><w:rPr><w:rtl/><w:lang w:bidi="ar-SY"/></w:rPr><w:t>نص</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs[0]?.runs[0]).toMatchObject({
      language: "en-US", eastAsiaLanguage: "zh-CN", bidiLanguage: "ar-SY",
    });
  });

  it("يحل تدرج w14:textFill وتحويلات ألوانه", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:w14="w14"><w:body><w:p><w:r><w:rPr>
      <w14:textFill><w14:gradFill><w14:gsLst>
        <w14:gs w14:pos="0"><w14:srgbClr w14:val="FF0000"><w14:shade w14:val="50000"/></w14:srgbClr></w14:gs>
        <w14:gs w14:pos="100000"><w14:srgbClr w14:val="FFFFFF"/></w14:gs>
      </w14:gsLst><w14:lin w14:ang="0"/></w14:gradFill></w14:textFill>
      </w:rPr><w:t>متدرج</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.runs[0]?.textGradient).toEqual({ angle: 90,
      stops: [{ pos: 0, color: "800000" }, { pos: 1, color: "FFFFFF" }] });
  });

  it("يحل عرض ولون w14:textOutline", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:w14="w14"><w:body><w:p><w:r><w:rPr>
      <w14:textOutline w14:w="9525"><w14:solidFill><w14:srgbClr w14:val="FF0000"><w14:shade w14:val="50000"/></w14:srgbClr></w14:solidFill><w14:prstDash w14:val="solid"/></w14:textOutline>
      </w:rPr><w:t>محدد</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.runs[0]?.textOutline).toEqual({ widthTwips: 15, color: "800000" });
  });
  it("يحل هندسة ولون وعتامة w14:shadow", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:w14="w14"><w:body><w:p><w:r><w:rPr>
      <w14:shadow w14:blurRad="19050" w14:dist="9525" w14:dir="0"><w14:srgbClr w14:val="FF0000"><w14:shade w14:val="50000"/><w14:alpha w14:val="35000"/></w14:srgbClr></w14:shadow>
      </w:rPr><w:t>مظلل</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.runs[0]?.textShadow).toEqual({
      xTwips: 15, yTwips: 0, blurTwips: 30, color: "800000", opacity: 0.35,
    });
  });
  it("يحفظ هندسة w14:reflection بلا إدخال النسخة في تدفق النص", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:w14="w14"><w:body><w:p><w:r><w:rPr>
      <w14:reflection w14:blurRad="12700" w14:stA="28000" w14:stPos="0"
        w14:endA="0" w14:endPos="45000" w14:dist="1003" w14:dir="5400000"
        w14:fadeDir="5400000" w14:sx="100000" w14:sy="-100000"/>
      </w:rPr><w:t>منعكس</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.runs[0]?.textReflection).toEqual(expect.objectContaining({
      blurTwips: 20, scaleX: 1, scaleY: -1, startOpacity: .28,
      endOpacity: 0, startPosition: 0, endPosition: .45, fadeAngle: 180,
    }));
    expect(model.paragraphs[0]?.text).toBe("منعكس");
  });
  it("يفصل بايت Word الخام عن محرف PUA اللازم للرسم", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:r>
      <w:sym w:font="AGA Arabesque" w:char="F072"/>
    </w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]!.runs[0]!.text).toBe("\uF072");
    expect(model.paragraphs[0]!.runs[0]!.sourceText).toBe("(");
    expect(model.paragraphs[0]!.text).toBe("(");
  });
});

describe("حدود الصفحات المرتبة", () => {
  it("يبقي مرساة الغلاف قبل lastRenderedPageBreak في الورقة السابقة", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:v="v" xmlns:r="r"><w:body><w:p>
      <w:r><w:pict><v:shape style="position:absolute;width:600pt;height:800pt;z-index:-1"><v:imagedata r:id="rCover"/></v:shape></w:pict></w:r>
      <w:r><w:lastRenderedPageBreak/><w:t>المتن</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`,
    parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]).toMatchObject({ pageBreaksBefore: 1, text: "المتن" });
    expect(model.paragraphs[0]!.anchors[0]).toMatchObject({ pageOffset: -1, behindDoc: true });
  });
  it("يدمج explicit مع lastRendered إذا فصلتهما بيانات مخفية فقط", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body>
      <w:p><w:r><w:t>قبل</w:t></w:r></w:p>
      <w:p><w:r><w:br w:type="page"/></w:r>
        <w:r><w:rPr><w:vanish/></w:rPr><w:t>{{PG:2}}</w:t></w:r>
        <w:r><w:lastRenderedPageBreak/><w:t>بعد</w:t></w:r></w:p>
      <w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[1]!.pageBreaksBefore).toBe(1);
  });

  it("يحفظ كسرين صريحين متتاليين بدل اختزالهما إلى boolean", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body>
      <w:p><w:r><w:t>قبل</w:t></w:r></w:p>
      <w:p><w:r><w:br w:type="page"/><w:br w:type="page"/><w:t>بعد</w:t></w:r></w:p>
      <w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[1]!.pageBreakBefore).toBe(true);
    expect(model.paragraphs[1]!.pageBreaksBefore).toBe(2);
  });
});

describe("Word STYLEREF fields", () => {
  it("يربط اسم النمط العربي بمعرّفه ويحفظه على رن النتيجة", () => {
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="Heading2">
      <w:name w:val="heading 2"/></w:style></w:styles>`);
    expect(styleRefField(' STYLEREF  "عنوان 2"  \\* MERGEFORMAT', styles)).toBe("STYLEREF:Heading2");
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText> STYLEREF </w:instrText></w:r><w:r><w:instrText> "عنوان 2" </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>عنوان قديم</w:t></w:r><w:r><w:t> مكمل</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r></w:p><w:sectPr/></w:body></w:document>`, styles);
    expect(model.paragraphs[0]!.runs.find(run => run.text === "عنوان قديم")?.fieldResult)
      .toBe("STYLEREF:Heading2");
    expect(model.paragraphs[0]!.runs.find(run => run.text === " مكمل")?.fieldResult).toBe("");
  });
});

describe("علامة الحاشية المخصصة", () => {
  it("يحفظ النص الذي يلي customMarkFollows ولا يستهلك رقمًا آليًا", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p>
      <w:r><w:footnoteReference w:customMarkFollows="1" w:id="7"/><w:t>(أ)</w:t></w:r>
      <w:r><w:footnoteReference w:id="8"/></w:r>
    </w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const [custom, automatic] = model.paragraphs[0]!.runs.map(run => run.noteRef!);
    expect(custom).toEqual(expect.objectContaining({ id: "7", custom: true, customMark: "(أ)" }));
    expect(model.paragraphs[0]!.runs[0]!.text).toBe("(أ)");
    expect(automatic).toEqual(expect.objectContaining({ id: "8", custom: false, num: 1 }));
  });
});

describe("فواصل الحواشي بحسب w:type", () => {
  it("يربط separator وcontinuationSeparator بدلالتهما ولو لم تكن المعرّفات -1/0", () => {
    const notes = `<w:footnotes xmlns:w="w">
      <w:footnote w:type="separator" w:id="42"><w:p><w:r><w:t>فاصل أول</w:t></w:r></w:p></w:footnote>
      <w:footnote w:type="continuationSeparator" w:id="43"><w:p><w:r><w:t>فاصل تابع</w:t></w:r></w:p></w:footnote>
    </w:footnotes>`;
    const parsed = parseNotes(notes, '<w:document xmlns:w="w"><w:body/></w:document>', parseStyles('<w:styles xmlns:w="w"/>'));
    expect(parsed.get("-1")?.[0]?.text).toBe("فاصل أول");
    expect(parsed.get("0")?.[0]?.text).toBe("فاصل تابع");
    expect(parsed.get("42")).toBe(parsed.get("-1"));
    expect(parsed.get("43")).toBe(parsed.get("0"));
  });
});

const SIYASA = new URL("../../../../../كتب للاختبار/السياسة الشرعية.. الطبعة الثانية.docx", import.meta.url);
const TAWHID = new URL("../../../../../كتب للاختبار/توحيد الحاكمية.docx", import.meta.url);
const SHAMI = new URL("../../../../../../الكتب والمقالات/أبو أنس الشامي.. عمر يوسف جمعة/سيرة الشيخ أبي أنس الشامي - أبو حمزة المهاجر.docx", import.meta.url);
const PUBLISHED_IBHAJ = new URL("../../../app/public/library/published/assets/7c464cf9b0b1ceb3.docx", import.meta.url);
const SANITIZED_IBHAJ = new URL("../../../docs/qa/publish-sanitized-staging/إبهاج أهل الصناعة بدراسة حديث بعثت بالسيف بين يدي الساعة - أبو ذر السمهري اليماني.docx", import.meta.url);
const describePublishedIbhaj = existsSync(PUBLISHED_IBHAJ) ? describe : describe.skip;
describePublishedIbhaj("علاقات OPC ذات namespace معاد تسميته", () => {
  it("يحل مراجع الرأس والتذييل في DOCX إبهاج المنشور بعد التعقيم", () => {
    const model = extractFromDocx(readFileSync(PUBLISHED_IBHAJ));
    expect(model.sections.flatMap(section => Object.values(section.headerRefs ?? {})))
      .toEqual(["header1.xml", "header2.xml"]);
    expect(model.sections.flatMap(section => Object.values(section.footerRefs ?? {})))
      .toEqual(["footer1.xml", "footer2.xml", "footer3.xml", "footer4.xml"]);
    for (const part of model.sections.flatMap(section => [
      ...Object.values(section.headerRefs ?? {}), ...Object.values(section.footerRefs ?? {}),
    ])) expect(model.headerFooters.has(part)).toBe(true);
  });
});
it.runIf(existsSync(SANITIZED_IBHAJ))("يحفظ مرساة غلاف إبهاج الكاملة page-coordinate رغم RTL وهوامش متساوية", () => {
  const model = extractFromDocx(readFileSync(SANITIZED_IBHAJ));
  expect(model.sections[0]).toMatchObject({ pageWTwips: 11906, pageHTwips: 16838,
    marLeftTwips: 2275, marRightTwips: 2275, marTopTwips: 2275, marBottomTwips: 2275 });
  const cover = model.paragraphs.flatMap(paragraph => paragraph.anchors)
    .find(anchor => anchor.vml && anchor.rId);
  expect(cover).toMatchObject({ posHRel: "column", posHOffset: -2280,
    posVRel: "paragraph", posVOffset: -2275, extentW: 11918, extentH: 16836,
    behindDoc: true });
  // Equal physical margins remain equal; the VML negative offset is an anchor
  // coordinate and must never be mirrored into section geometry for RTL.
  expect(model.sections[0]!.marLeftTwips).toBe(model.sections[0]!.marRightTwips);
});
const describeShami = describe.skip;
describeShami("انحدار غلاف سيرة الشيخ أبي أنس الشامي", () => {
  let model: ReturnType<typeof extractFromDocx>;
  beforeAll(() => { model = extractFromDocx(readFileSync(SHAMI)); });
  it("يفصل غلاف VML السابق للكسر عن متن الصفحة الثانية ويحفظ first فارغًا", () => {
    expect(model.paragraphs[0]).toMatchObject({ pageBreaksBefore: 1 });
    expect(model.paragraphs[0]!.anchors).toHaveLength(1);
    expect(model.paragraphs[0]!.anchors[0]).toMatchObject({ pageOffset: -1,
      behindDoc: true, vml: true });
    expect(model.section.titlePg).toBe(true);
    expect(model.section.headerRefs?.first).toBeUndefined();
    expect(model.section.footerRefs?.first).toBeUndefined();
    expect(model.section.headerRefs?.default).toBe("header2.xml");
    expect(model.section.footerRefs?.default).toBe("footer1.xml");
    expect(model.evenAndOddHeaders).toBe(false);
    expect(model.headerFooters.get("header2.xml")?.flatMap(p => p.anchors).length).toBe(1);
    expect(model.headerFooters.get("footer1.xml")?.flatMap(p => p.anchors).length).toBe(1);
  });
});
const describeTawhidContextualSpacing = existsSync(TAWHID) ? describe : describe.skip;
describeTawhidContextualSpacing("انحدار contextualSpacing في توحيد الحاكمية", () => {
  const model = extractFromDocx(readFileSync(TAWHID));
  it("يحسم الخاصية الموروثة على فقرات corpus ولا يتركها وسمًا ميتًا", () => {
    const contextual = model.paragraphs.filter(paragraph => paragraph.contextualSpacing);
    expect(contextual.length).toBeGreaterThan(100);
    expect(contextual.some((paragraph, index) => index > 0
      && model.paragraphs[index - 1]!.styleId === paragraph.styleId)).toBe(true);
  });
  it("يحسم Auto المقاسة إلى 100twips على فقرات الكتاب كلها", () => {
    const auto = model.paragraphs.filter(paragraph =>
      paragraph.spacing.beforeAuto || paragraph.spacing.afterAuto);
    expect(auto).toHaveLength(181);
    expect(auto.every(paragraph => paragraph.spacing.before === 100
      && paragraph.spacing.after === 100)).toBe(true);
  });
});
const describeSiyasa = existsSync(SIYASA) ? describe : describe.skip;
describeSiyasa("انحدار علامات الحواشي المخصصة في السياسة الشرعية", () => {
  const model = extractFromDocx(readFileSync(SIYASA));

  it("يحفظ العلامات الإحدى عشرة من corpus بلا استبدالها بأرقام آلية", () => {
    const refs = model.paragraphs.flatMap(paragraph => paragraph.runs)
      .map(run => run.noteRef).filter(ref => ref?.custom);
    expect(refs).toHaveLength(11);
    expect(refs.every(ref => Boolean(ref?.customMark))).toBe(true);
    expect(refs.some(ref => ref?.customMark === "(1)")).toBe(true);
  });
});

describe("DrawingML relative size", () => {
  it("keeps wp:extent when sizeRel is zero", () => {
    expect(relativeSize("margin", "0")).toBeUndefined();
    expect(relativeSize("page", "50000")).toEqual({ from: "page", pct: 0.5 });
  });
});

describe("إطار فقرة الرأس والتذييل", () => {
  it("يحفظ هندسة framePr وتوقيع التجميع", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:pPr>
      <w:framePr w:w="715" w:wrap="around" w:vAnchor="text" w:hAnchor="text" w:y="5"/>
    </w:pPr><w:r><w:t>[85]</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`,
    parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]!.framePr).toEqual(expect.objectContaining({
      w: 715, y: 5, hAnchor: "text", vAnchor: "text", wrap: "around",
    }));
    expect(model.paragraphs[0]!.framePr?.signature).toContain("@w:w");
  });
});

const IBHAJ = new URL("../../../../../كتب للاختبار/إبهاج أهل الصناعة بدراسة حديث بعثت بالسيف بين يدي الساعة.docx", import.meta.url);
const ARBAUN = new URL("../../../../../كتب للاختبار/الأربعون الجياد لأهل التوحيد والجهاد.docx", import.meta.url);
const describeCorpusFrames = existsSync(IBHAJ) && existsSync(ARBAUN) ? describe : describe.skip;
describeCorpusFrames("انحدار framePr في كتب الاختبار", () => {
  const frames = [IBHAJ, ARBAUN].flatMap(url => [...extractFromDocx(readFileSync(url)).headerFooters.values()]
    .flat().filter(paragraph => paragraph.framePr));

  it("يحفظ الإطارات الستة من الرؤوس والتذييلات بدل رصفها كفقرات عادية", () => {
    expect(frames).toHaveLength(6);
    expect(frames.every(paragraph => paragraph.framePr?.hAnchor === "text"
      && paragraph.framePr.vAnchor === "text")).toBe(true);
    expect(frames.filter(paragraph => paragraph.framePr?.w === 715)).toHaveLength(2);
  });
});

describe("DrawingML paragraph-relative anchors", () => {
  it("يحفظ كل نسخة من الزخرفة مع فقرتها المالكة", () => {
    const anchor = (rid: string) => `<w:r><w:drawing><wp:anchor relativeHeight="1" behindDoc="0" layoutInCell="1">
      <wp:positionH relativeFrom="column"><wp:posOffset>5273304</wp:posOffset></wp:positionH>
      <wp:positionV relativeFrom="paragraph"><wp:posOffset>60960</wp:posOffset></wp:positionV>
      <wp:extent cx="396815" cy="409941"/><wp:wrapNone/><a:graphic><a:graphicData>
        <pic:pic><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill></pic:pic>
      </a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:wp="wp" xmlns:a="a" xmlns:pic="pic" xmlns:r="r"><w:body>
      <w:p><w:r><w:t>الأول</w:t></w:r>${anchor("rDecor")}</w:p>
      <w:p><w:r><w:t>الثاني</w:t></w:r>${anchor("rDecor")}</w:p><w:sectPr/>
    </w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs.map(p => p.anchors.length)).toEqual([1, 1]);
    expect(model.paragraphs.map(p => p.anchors[0]?.posVRel)).toEqual(["paragraph", "paragraph"]);
    expect(model.paragraphs.map(p => p.anchors[0]?.posVOffset)).toEqual([96, 96]);
    expect(model.paragraphs[0]!.anchors[0]).not.toBe(model.paragraphs[1]!.anchors[0]);
  });
});

describe("VML grouped text boxes", () => {
  it("يميز صورة VML السطرية من الشكل ذي position:absolute", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:v="v" xmlns:r="r"><w:body><w:p><w:r><w:pict>
      <v:shape style="width:202pt;height:42.5pt"><v:imagedata r:id="inline"/></v:shape>
      <v:shape style="position:absolute;width:202pt;height:42.5pt"><v:imagedata r:id="float"/></v:shape>
      </w:pict></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.anchors[0]?.inlineFlow).toBe(true);
    expect(model.paragraphs[0]?.anchors[1]?.inlineFlow).not.toBe(true);
  });

  it("يحفظ النص والحشو والإطار داخل شكل VML مجمّع", () => {
    const model = parseDocument(`
      <w:document xmlns:w="w" xmlns:v="v"><w:body><w:p><w:r><w:pict>
        <v:group style="position:absolute;width:100pt;height:50pt" coordsize="1000,500">
          <v:shape style="left:100;top:50;width:800;height:200;v-text-anchor:middle"
            fillcolor="#ffeecc" strokecolor="#123456" strokeweight="2pt">
            <v:textbox inset="1pt,2pt,3pt,4pt"><w:txbxContent><w:p><w:r><w:t>نص داخل إطار</w:t></w:r></w:p></w:txbxContent></v:textbox>
          </v:shape>
        </v:group>
      </w:pict></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const anchor = model.paragraphs[0]?.anchors[0];
    expect(anchor?.textBox?.[0]?.text).toBe("نص داخل إطار");
    expect(anchor?.boxIns).toEqual({ l: 20, t: 40, r: 60, b: 80 });
    expect(anchor?.boxAnchor).toBe("ctr");
    expect(anchor?.shape).toEqual(expect.objectContaining({ fill: "FFEECC", stroke: "123456", strokeW: 40 }));
    expect(anchor?.extentW).toBe(1600);
    expect(anchor?.extentH).toBe(400);
  });

  it("يحفظ مسافات التفاف VML بالـtwips بدل تصفيرها", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:v="v" xmlns:w10="w10"><w:body><w:p><w:r><w:pict>
      <v:rect style="position:absolute;width:40pt;height:20pt;mso-wrap-distance-left:9pt;mso-wrap-distance-right:6pt;mso-wrap-distance-top:3pt;mso-wrap-distance-bottom:1.5pt">
        <w10:wrap type="square"/>
      </v:rect></w:pict></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.anchors[0]).toEqual(expect.objectContaining({
      distL: 180, distR: 120, distT: 60, distB: 30, wrap: "Square",
    }));
  });

  it("يحفظ flip ودوران VML العادي وOffice fixed-point", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:v="v"><w:body><w:p><w:r><w:pict>
      <v:rect style="position:absolute;width:40pt;height:20pt;flip:x y;rotation:-90"/>
      <v:rect style="position:absolute;width:40pt;height:20pt;rotation:-5898240fd"/>
      </w:pict></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.anchors[0]).toEqual(expect.objectContaining({
      flipH: true, flipV: true, rotDeg: -90,
    }));
    expect(model.paragraphs[0]?.anchors[1]?.rotDeg).toBe(-90);
  });

  it("يحفظ linestyle المركب من v:stroke", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:v="v"><w:body><w:p><w:r><w:pict>
      <v:rect strokecolor="black" strokeweight="1pt" style="position:absolute;width:40pt;height:20pt">
        <v:stroke linestyle="thinThick"/>
      </v:rect></w:pict></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.anchors[0]?.shape?.lineStyle).toBe("thinThick");
  });

  it("يحل o:spt=9 إلى سداسي بدل مستطيل VML عام", () => {
    const model = parseDocument(`<w:document xmlns:w="w" xmlns:v="v" xmlns:o="o"><w:body><w:p><w:r><w:pict>
      <v:shapetype id="hex" o:spt="9"/><v:shape type="#hex" fillcolor="#CC0000"
        style="position:absolute;width:60pt;height:40pt"/>
      </w:pict></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.anchors[0]?.shape?.prst).toBe("hexagon");
  });
});

describe("DrawingML shape style references", () => {
  it("يقرأ dk1/lt1 من clrScheme الحقيقي", () => {
    const theme = parseTheme(`<a:theme xmlns:a="a"><a:themeElements><a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
    </a:clrScheme></a:themeElements></a:theme>`);
    expect(theme.get("dk1")).toBe("000000");
    expect(theme.get("text1")).toBe("000000");
    expect(theme.get("lt1")).toBe("FFFFFF");
    expect(theme.get("background1")).toBe("FFFFFF");
  });

  it("يحل خطوط major/minor من fontScheme", () => {
    const theme = parseTheme(`<a:theme xmlns:a="a"><a:themeElements><a:clrScheme name="x"><a:dk1><a:srgbClr val="000000"/></a:dk1></a:clrScheme><a:fontScheme name="x"><a:majorFont><a:latin typeface="Cambria"/><a:ea typeface="MS Mincho"/><a:cs typeface="Traditional Arabic"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface="DengXian"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`);
    expect(theme.get("__font:majorBidi")).toBe("Traditional Arabic");
    expect(theme.get("__font:minorHAnsi")).toBe("Calibri");
    const styles = parseStyles(`<w:styles xmlns:w="w"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:cstheme="majorBidi"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`, theme);
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>نص</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`, styles, undefined, theme);
    expect(model.paragraphs[0]?.runs[0]?.family).toBe("Traditional Arabic");
  });

  it("يحل ظل effectRef من fmtScheme بدل إسقاطه", () => {
    const theme = parseTheme(`<a:theme xmlns:a="a"><a:themeElements>
      <a:clrScheme name="Office"><a:dk1><a:srgbClr val="000000"/></a:dk1></a:clrScheme>
      <a:fmtScheme name="Office"><a:effectStyleLst>
        <a:effectStyle><a:effectLst><a:outerShdw blurRad="40000" dist="20000" dir="5400000">
          <a:srgbClr val="000000"><a:alpha val="38000"/></a:srgbClr>
        </a:outerShdw></a:effectLst></a:effectStyle>
      </a:effectStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
    expect(JSON.parse(theme.get("__effectStyle:1") ?? "null")).toEqual(expect.objectContaining({
      blurRad: 40000, dist: 20000, dir: 5400000, color: "000000", opacity: .38,
    }));
  });

  it("يحفظ قالب gradFill المشار إليه من fillRef", () => {
    const theme = parseTheme(`<a:theme xmlns:a="a"><a:themeElements>
      <a:clrScheme name="Office"><a:dk1><a:srgbClr val="000000"/></a:dk1></a:clrScheme>
      <a:fmtScheme name="Office"><a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:gradFill><a:gsLst>
          <a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:gs>
          <a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:gs>
        </a:gsLst><a:lin ang="5400000"/></a:gradFill>
      </a:fillStyleLst><a:effectStyleLst/></a:fmtScheme></a:themeElements></a:theme>`);
    expect(JSON.parse(theme.get("__fillStyle:2") ?? "null")).toEqual(expect.objectContaining({ angle: 180 }));
  });

  it("يحل gradFill الصريح داخل الشكل مع تحويلات اللون", () => {
    const model = parseDocument(`
      <w:document xmlns:w="w" xmlns:wp="wp" xmlns:a="a" xmlns:wps="wps"><w:body><w:p><w:r><w:drawing>
        <wp:anchor><wp:extent cx="914400" cy="457200"/><a:graphic><a:graphicData><wps:wsp>
          <wps:spPr><a:gradFill><a:gsLst>
            <a:gs pos="0"><a:srgbClr val="204060"><a:tint val="50000"/></a:srgbClr></a:gs>
            <a:gs pos="100000"><a:srgbClr val="204060"><a:shade val="50000"/></a:srgbClr></a:gs>
          </a:gsLst><a:lin ang="0"/></a:gradFill><a:prstGeom prst="rect"/></wps:spPr>
          <wps:txbx><w:txbxContent><w:p><w:r><w:t>رأس</w:t></w:r></w:p></w:txbxContent></wps:txbx>
        </wps:wsp></a:graphicData></a:graphic></wp:anchor>
      </w:drawing></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.anchors[0]?.shape).toEqual(expect.objectContaining({
      fill: "90A0B0", gradient: { angle: 90, stops: [
        { pos: 0, color: "90A0B0" }, { pos: 1, color: "102030" },
      ] },
    }));
  });

  it("يفصل صورة حشو مربع النص عن صورة العنصر كي لا يحذف النص", () => {
    const model = parseDocument(`
      <w:document xmlns:w="w" xmlns:wp="wp" xmlns:a="a" xmlns:r="r" xmlns:wps="wps"><w:body><w:p><w:r><w:drawing>
        <wp:anchor><wp:extent cx="914400" cy="457200"/><a:graphic><a:graphicData><wps:wsp>
          <wps:spPr><a:blipFill><a:blip r:embed="rBg"/><a:srcRect l="10000"/><a:stretch/></a:blipFill>
            <a:prstGeom prst="rect"/></wps:spPr>
          <wps:txbx><w:txbxContent><w:p><w:r><w:t>عنوان فوق الصورة</w:t></w:r></w:p></w:txbxContent></wps:txbx>
        </wps:wsp></a:graphicData></a:graphic></wp:anchor>
      </w:drawing></w:r></w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const anchor = model.paragraphs[0]?.anchors[0];
    expect(anchor?.rId).toBeNull();
    expect(anchor?.shapeFill).toEqual({ rId: "rBg", mode: "stretch",
      srcRect: { l: .1, t: 0, r: 0, b: 0 } });
    expect(anchor?.textBox?.[0]?.text).toBe("عنوان فوق الصورة");
  });

  it("يحل fillRef/lnRef لمربع PAGE عند غياب الحشو المباشر", () => {
    const model = parseDocument(`
      <w:document xmlns:w="w" xmlns:wp="wp" xmlns:a="a" xmlns:wps="wps"><w:body><w:p><w:r><w:drawing>
        <wp:anchor relativeHeight="1"><wp:positionH relativeFrom="page"><wp:align>right</wp:align></wp:positionH>
          <wp:positionV relativeFrom="topMargin"><wp:align>center</wp:align></wp:positionV>
          <wp:extent cx="914400" cy="170815"/><a:graphic><a:graphicData><wps:wsp>
            <wps:spPr><a:prstGeom prst="rect"/></wps:spPr>
            <wps:style><a:lnRef idx="1"><a:schemeClr val="dk1"/></a:lnRef>
              <a:fillRef idx="3"><a:schemeClr val="dk1"/></a:fillRef>
              <a:effectRef idx="2"><a:schemeClr val="dk1"/></a:effectRef></wps:style>
            <wps:txbx><w:txbxContent><w:p><w:r><w:t>PAGE</w:t></w:r></w:p></w:txbxContent></wps:txbx>
          </wps:wsp></a:graphicData></a:graphic>
        </wp:anchor>
      </w:drawing></w:r></w:p><w:sectPr/></w:body></w:document>`,
      parseStyles('<w:styles xmlns:w="w"/>'), new Map(), new Map([["dk1", "000000"],
        ["__fillStyle:3", JSON.stringify({ angle: 0, stops: [
          { pos: 0, token: "phClr", transforms: { tint: 20000 } },
          { pos: 1, token: "phClr", transforms: {} },
        ] })],
        ["__effectStyle:2", JSON.stringify({ blurRad: 40000, dist: 23000, dir: 5400000,
          color: "000000", opacity: .35 })]]));
    const anchor = model.paragraphs[0]?.anchors[0];
    const shape = anchor?.shape;
    expect(shape).toEqual(expect.objectContaining({ fill: "000000", stroke: "000000", strokeW: 15 }));
    expect(shape?.gradient).toEqual({ angle: 0, stops: [
      { pos: 0, color: "333333" }, { pos: 1, color: "000000" },
    ] });
    expect(anchor?.imageEffects?.shadow).toEqual(expect.objectContaining({ color: "000000", opacity: .35 }));
  });
});

const DOCX = "corpus/books/sample-masjid.docx";

describe("ooxml-model v0 — عينة حقيقية", () => {
  const model = extractFromDocx(readFileSync(new URL(`../../../${DOCX}`, import.meta.url)));

  it("يقرأ هندسة القسم بالـ twips ويحسب عرض العمود", () => {
    const s = model.section;
    expect(s.pageWTwips).toBeGreaterThan(10000);
    expect(s.columnTwips).toBe(s.pageWTwips - s.marLeftTwips - s.marRightTwips);
  });

  it("يستخرج فقرات متن بنص وخط وحجم فعالين (سلسلة الوراثة تعمل)", () => {
    const body = model.paragraphs.filter((p) => !p.excluded && p.text.trim().length > 40);
    expect(body.length).toBeGreaterThan(10);
    const withFont = body.filter((p) => p.runs.every((r) => r.family && r.emTwips));
    // الأغلبية يجب أن تُحل خطوطها وأحجامها عبر النمط/الافتراضيات لا أن تبقى null
    expect(withFont.length / body.length).toBeGreaterThan(0.8);
  });

  it("يقصي الفقرات ذات الحقول/الرسومات/التبويبات بعلامة لا بالحذف الصامت", () => {
    const excluded = model.paragraphs.filter((p) => p.excluded);
    expect(excluded.length).toBeGreaterThan(0);
  });
});

describe("ooxml-model v0 — تقسيم الصفحات (w:lastRenderedPageBreak)", () => {
  const model = extractFromDocx(readFileSync(new URL(`../../../corpus/books/sample-ahadith.docx`, import.meta.url)));

  it("يحوّل علامات كسر الصفحة التي رصّفها Word إلى pageBreakBefore", () => {
    const breaks = model.paragraphs.filter((p) => p.pageBreakBefore);
    expect(breaks.length).toBeGreaterThan(0);
  });

  it("تقسيم الصفحات يغطي كل علامات XML (لا فقرة كسر ضائعة)", () => {
    const docx = readFileSync(new URL(`../../../corpus/books/sample-ahadith.docx`, import.meta.url));
    const { documentXml } = openDocx(docx);
    const markers = (documentXml.match(/w:lastRenderedPageBreak/g) ?? []).length;
    const breaks = model.paragraphs.filter((p) => p.pageBreakBefore).length;
    // كلُّ علامة تُنتج كسرَ صفحةٍ على الفقرة الحاملة أو التالية (لا تُسقَط)
    expect(breaks).toBeGreaterThanOrEqual(markers);
  });
});

describe("إعدادات الحواشي الخاصة بالمقطع", () => {
  const model = extractFromDocx(readFileSync(new URL("../../../corpus/books/sample-jalsa27.docx", import.meta.url)));

  it("يقرأ numRestart=eachPage من sectPr بدل إسقاطه", () => {
    expect(model.sections.some(section => section.footnotePr?.restart === "eachPage")).toBe(true);
  });

  it("يحفظ مربع PAGE داخل مجموعة VML واقعية في التذييل", () => {
    const anchors = [...model.headerFooters.values()].flat()
      .flatMap(paragraph => paragraph.anchors).filter(anchor => anchor.vml);
    const pageBox = anchors.find(anchor => anchor.textBox?.some(paragraph => paragraph.text === "26"));
    expect(pageBox).toBeDefined();
    expect(pageBox).toEqual(expect.objectContaining({
      extentW: 525, extentH: 720, posHOffset: 802, posVOffset: 15499,
      boxIns: { l: 144, t: 72, r: 144, b: 72 },
    }));
    expect(pageBox?.shape).toEqual(expect.objectContaining({ fill: "FFFFFF", stroke: "737373" }));
  });
});

const describeTawhidFooter = existsSync(TAWHID) ? describe : describe.skip;
describeTawhidFooter("تذييل توحيد الحاكمية داخل Content Control", () => {
  const model = extractFromDocx(readFileSync(TAWHID));

  it("يحفظ فقرة PAGE داخل w:sdt قبل الفقرة الفارغة", () => {
    const footer = model.headerFooters.get("footer1.xml") ?? [];
    expect(footer).toHaveLength(2);
    expect(footer[0]!.runs.some(run => run.fieldResult === "PAGE")).toBe(true);
    expect(footer[0]!.jc).toBe("center");
    expect(footer[1]!.text).toBe("");
  });
});

describe("أنماط الجداول الشرطية", () => {
  it("يعرض التنسيق الحالي ولا يستبدله بتاريخ rPrChange", () => {
    const model = parseDocument(`
      <w:document xmlns:w="w"><w:body><w:p>
        <w:r><w:t xml:space="preserve">قبل </w:t></w:r>
        <w:r><w:rPr><w:b/><w:color w:val="FF0000"/>
          <w:rPrChange w:id="0" w:author="reviewer"><w:rPr><w:b w:val="0"/><w:color w:val="000000"/></w:rPr></w:rPrChange>
        </w:rPr><w:t>مراجعة</w:t></w:r>
        <w:r><w:t xml:space="preserve"> بعد</w:t></w:r>
      </w:p><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.text).toBe("قبل مراجعة بعد");
    expect(model.paragraphs[0]?.runs[1]).toEqual(expect.objectContaining({
      text: "مراجعة", bold: true, color: "FF0000",
    }));
  });

  it("يحفظ كل رابط خارجي مستقلًا داخل خلية الجدول", () => {
    const rels = new Map([
      ["rEcma", "http://www.ecma.org/"],
      ["rOffice", "http://office/14/howto/Wiki%20Pages/How%20to%20test.aspx"],
    ]);
    const model = parseDocument(`
      <w:document xmlns:w="w" xmlns:r="r"><w:body><w:tbl>
        <w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc><w:p>
          <w:hyperlink r:id="rEcma"><w:r><w:t>ECMA</w:t></w:r></w:hyperlink>
          <w:r><w:t> ثم </w:t></w:r>
          <w:hyperlink r:id="rOffice"><w:r><w:t>Office</w:t></w:r></w:hyperlink>
        </w:p></w:tc></w:tr>
      </w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'),
      new Map(), new Map(), rels);
    const paragraph = model.paragraphs.find(p => p.tableCell);
    expect(paragraph?.tableCell).toEqual(expect.objectContaining({ row: 0, col: 0 }));
    expect(paragraph?.runs.map(run => [run.text, run.href])).toEqual([
      ["ECMA", "http://www.ecma.org/"],
      [" ثم ", null],
      ["Office", "http://office/14/howto/Wiki%20Pages/How%20to%20test.aspx"],
    ]);
  });

  it("يحفظ fixed ويجعل غياب tblLayout تخطيطًا تلقائيًا", () => {
    const table = (layout: string) => parseDocument(`
      <w:document xmlns:w="w"><w:body><w:tbl><w:tblPr>${layout}</w:tblPr>
        <w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid>
        <w:tr><w:tc><w:p><w:r><w:t>خلية</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(table('<w:tblLayout w:type="fixed"/>').paragraphs[0]?.tableCell?.tblLayout).toBe("fixed");
    expect(table('').paragraphs[0]?.tableCell?.tblLayout).toBe("autofit");
  });

  it("يجعل محاذاة الصف الصريحة تتقدم على محاذاة الجدول", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:tbl>
      <w:tblPr><w:jc w:val="right"/></w:tblPr><w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid>
      <w:tr><w:trPr><w:jc w:val="center"/></w:trPr><w:tc><w:p><w:r><w:t>أ</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>ب</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    expect(model.paragraphs[0]?.tableCell?.tblJc).toBe("center");
    expect(model.paragraphs[1]?.tableCell?.tblJc).toBe("right");
  });

  it("يوزع insideH وinsideV على حواف الخلايا الداخلية دون استبدال الإطار الخارجي", () => {
    const model = parseDocument(`<w:document xmlns:w="w"><w:body><w:tbl><w:tblPr><w:tblBorders>
      <w:top w:val="double" w:sz="8"/><w:bottom w:val="double" w:sz="8"/>
      <w:left w:val="double" w:sz="8"/><w:right w:val="double" w:sz="8"/>
      <w:insideH w:val="dashed" w:sz="4"/><w:insideV w:val="dotted" w:sz="4"/>
      </w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1000"/><w:gridCol w:w="1000"/></w:tblGrid>
      <w:tr><w:tc><w:p><w:r><w:t>أ</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>ب</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>ج</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>د</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl><w:sectPr/></w:body></w:document>`, parseStyles('<w:styles xmlns:w="w"/>'));
    const borders = model.paragraphs.map(p => p.tableCell!.tcBorders!);
    expect(borders[0]).toEqual(expect.objectContaining({
      top: expect.objectContaining({ val: "double" }), left: expect.objectContaining({ val: "double" }),
      bottom: expect.objectContaining({ val: "dashed" }), right: expect.objectContaining({ val: "dotted" }),
    }));
    expect(borders[3]).toEqual(expect.objectContaining({
      top: expect.objectContaining({ val: "dashed" }), left: expect.objectContaining({ val: "dotted" }),
      bottom: expect.objectContaining({ val: "double" }), right: expect.objectContaining({ val: "double" }),
    }));
  });

  it("يطبق firstRow والتناوب الأفقي من tblStylePr ويحترم tblLook", () => {
    const styles = parseStyles(`
      <w:styles xmlns:w="w">
        <w:style w:type="table" w:styleId="Fancy">
          <w:tblPr><w:shd w:fill="FFF2CC"/><w:tblStyleRowBandSize w:val="2"/></w:tblPr>
          <w:tblStylePr w:type="firstRow">
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:szCs w:val="28"/><w:rFonts w:cs="Arial"/></w:rPr>
            <w:tcPr><w:shd w:fill="C00000"/><w:tcBorders><w:top w:val="double" w:sz="8" w:color="000000"/></w:tcBorders></w:tcPr>
          </w:tblStylePr>
          <w:tblStylePr w:type="band1Horz"><w:tcPr><w:shd w:fill="E2F0D9"/></w:tcPr></w:tblStylePr>
          <w:tblStylePr w:type="band2Horz"><w:tcPr><w:shd w:fill="D9EAF7"/></w:tcPr></w:tblStylePr>
        </w:style>
      </w:styles>`);
    const model = parseDocument(`
      <w:document xmlns:w="w"><w:body><w:tbl>
        <w:tblPr><w:tblStyle w:val="Fancy"/><w:tblLook w:firstRow="1" w:noHBand="0"/></w:tblPr>
        <w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid>
        <w:tr><w:tc><w:p><w:r><w:t>رأس</w:t></w:r><w:r><w:rPr><w:b w:val="0"/><w:color w:val="00FF00"/></w:rPr><w:t> مباشر</w:t></w:r></w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p><w:r><w:t>صف 1</w:t></w:r></w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p><w:r><w:t>صف 2</w:t></w:r></w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p><w:r><w:t>صف 3</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl><w:sectPr/></w:body></w:document>`, styles);
    const cells = model.paragraphs.filter(p => p.tableCell);
    expect(cells[0]?.tableCell?.shdFill).toBe("C00000");
    expect(cells[0]?.tableCell?.tcBorders?.top?.val).toBe("double");
    expect(cells[0]?.jc).toBe("center");
    expect(cells[0]?.runs[0]?.bold).toBe(true);
    expect(cells[0]?.runs[0]?.color).toBe("FFFFFF");
    expect(cells[0]?.runs[0]?.family).toBe("Arial");
    expect(cells[0]?.runs[0]?.emTwips).toBe(280);
    expect(cells[0]?.runs[1]?.bold).toBe(false);
    expect(cells[0]?.runs[1]?.color).toBe("00FF00");
    expect(cells[1]?.tableCell?.shdFill).toBe("E2F0D9");
    expect(cells[2]?.tableCell?.shdFill).toBe("E2F0D9");
    expect(cells[3]?.tableCell?.shdFill).toBe("D9EAF7");
  });
});
