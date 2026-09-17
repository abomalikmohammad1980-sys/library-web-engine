/** ‏ParagraphTable — تحويل فقرات خلايا الجدول المتتالية إلى <table> DOM
 *  (ترجمة مفهومية من `ParagraphTable.dart`): شبكة tblGrid، دمجٌ أفقي (gridSpan)
 *  وعمودي (vMerge)، حدودُ الخلايا، تظليلها، هوامشها، ومحاذاتها العمودية. */

import type { BodyParagraph, BorderSide, Borders4, SectionGeometry } from "@engine/ooxml-model";
import { css, el, px } from "./dom.js";
import { twipsToPx } from "./units.js";
import { paragraphToElement, type RenderCtx } from "./Paragraph.js";
import { wordBorderStyle } from "./BorderCss.js";
import { paragraphEndsWithManualLineBreak } from "./PPr.js";

export interface CellData {
  col: number;
  colSpan: number;
  rowSpan: number;
  paras: BodyParagraph[];
  shdFill: string | null;
  vAlign: string | null;
  textDirection: string | null;
  marTop: number; marBottom: number; marLeft: number; marRight: number;
  borders: Borders4 | null;
}

export interface TableData {
  tableId: number;
  parentTableId?: number; parentRow?: number; parentCol?: number; parentBlockIndex?: number; nestingDepth?: number;
  totalGridTwips: number;
  bidiVisual: boolean;
  tblIndTwips: number;
  tblJc: string | null;
  tblWVal: number;
  tblWType: string;
  tblLayout: "fixed" | "autofit";
  rows: { row: number; cantSplit: boolean; repeatHeader: boolean; rowHeight: number | null; rowHeightRule: string | null; cells: CellData[] }[];
}

function isAlternatingSingleHemistichTable(t: TableData): boolean {
  if (t.rows.length < 1) return false;
  // بعض المقاطع (ومنها الإهداء) ألّفها Word كشطر منفرد يتناوب بين
  // جانبي شبكة من ثلاثة أعمدة: خلية الشطر تمتد عمودين والخلية المقابلة
  // فارغة. عدّ الخلايا وحده يجعلها تبدو جدولًا ثنائيًا غير متوازن، مع
  // أنها في الحقيقة شعر مضبوط بـ lowKashida. نثبتها من بنية Word نفسها
  // بلا تخمين نصي، كي يصل «التباعد الصغير» أيضًا إلى البيت المنفرد.
  return t.rows.every(row => {
    if (row.cells.length !== 2) return false;
    const visible = row.cells.filter(cell => cell.paras.some(paragraph => paragraph.text.trim()));
    if (visible.length !== 1) return false;
    const [hemistich] = visible;
    if (!hemistich || hemistich.colSpan !== 2) return false;
    const paragraphs = hemistich.paras.filter(paragraph => paragraph.text.trim());
    return paragraphs.length > 0 && paragraphs.every(paragraph =>
      /[\u0600-\u06ff]/u.test(paragraph.text)
      && (paragraph.jc === "lowKashida" || paragraph.jc === "mediumKashida"
        || paragraph.jc === "highKashida"));
  });
}

/** يميّز جدول صدر/عجز القصيدة من بنيته، لا من w:jc الذي يغيب في بعض صفحات Word. */
export function isPoetryHemistichTable(t: TableData): boolean {
  if (t.rows.length < 1) return false;
  if (isAlternatingSingleHemistichTable(t)) return true;
  const physicalColumns = Math.max(...t.rows.map(row => row.cells.length));
  if (physicalColumns !== 2 && physicalColumns !== 3) return false;
  const verseRows = t.rows.filter(row => row.cells.length === physicalColumns);
  // قد تتخلل الأبيات لازمةٌ مؤلفة كخلية واحدة ممتدة على الأعمدة الثلاثة.
  if (verseRows.length < 1 || t.rows.some(row => row.cells.length !== physicalColumns
    && !(row.cells.length === 1 && row.cells[0]!.col === 0 && row.cells[0]!.colSpan >= physicalColumns))) return false;
  const cols = verseRows[0]!.cells.map(cell => cell.col);
  if (new Set(cols).size !== physicalColumns || t.rows.some(row => row.cells.some((cell, i) => cell.col !== cols[i]))) return false;
  const widths = cols.map(col => {
    const cell = t.rows.find(row => row.cells.some(candidate => candidate.col === col))!.cells.find(candidate => candidate.col === col)!;
    return cell.paras[0]!.tableCell!.colWTwips;
  });
  const firstWidth = widths[0]!, lastWidth = widths.at(-1)!;
  if (Math.abs(firstWidth - lastWidth) > Math.max(firstWidth, lastWidth) * 0.15) return false;
  if (physicalColumns === 3) {
    const separatorWidth = widths[1]!;
    if (separatorWidth >= (firstWidth + lastWidth) * 0.2) return false;
    const middle = verseRows.flatMap(row => row.cells.filter(cell => cell.col === cols[1]));
    if (middle.some(cell => cell.paras.some(paragraph => paragraph.text.trim()))) return false;
  }
  const separatorCol = physicalColumns === 3 ? cols[1] : null;
  const outer = t.rows.flatMap(row => row.cells.filter(cell => cell.col !== separatorCol))
    .flatMap(cell => cell.paras).filter(paragraph => paragraph.text.trim());
  if (outer.length < 2) return false;
  // يستبعد الجداول الرقمية/البيانية حتى لو صادف أن شبكتها 3 أعمدة.
  const arabic = outer.filter(paragraph => /[\u0600-\u06ff]/u.test(paragraph.text)).length / outer.length >= 0.6;
  // جدول البيت المفرد لا يملك صفًا ثانيًا يساعد في التصنيف؛ نعتمده فقط
  // حين يحمل شطراه صراحة محاذاة الكشيدة التي كتبها Word.
  const singleVerseIsExplicit = t.rows.length > 1 || outer.every(paragraph =>
    paragraph.jc === "lowKashida" || paragraph.jc === "mediumKashida" || paragraph.jc === "highKashida");
  return arabic && singleVerseIsExplicit;
}

export function isPoetryHemistichParagraph(t: TableData, cell: CellData, paragraph: BodyParagraph): boolean {
  if (!isPoetryHemistichTable(t) || !paragraph.text.trim()) return false;
  if (isAlternatingSingleHemistichTable(t)) return true;
  const physicalColumns = Math.max(...t.rows.map(row => row.cells.length));
  const middleCol = physicalColumns === 3
    ? t.rows.find(row => row.cells.length === 3)!.cells[1]!.col : null;
  // الخلية الممتدة على الجدول كله لازمة/فاصل داخل القصيدة وليست صدرًا أو
  // عجزًا؛ مطّها إلى عرض الصفحة هو سبب التشوه الكبير في الصفحات الحدية.
  return cell.colSpan < physicalColumns && cell.col !== middleCol;
}

/** ‏w:trHeight@hRule: auto لا يفرض الارتفاع حتى إن وُجدت w:val؛ exact يفرضه
 * وatLeast وحده يحوله إلى حد أدنى. */
export function rowHeightCss(height: number | null, rule: string | null): string {
  if (height == null) return "";
  if (rule === "exact") return `height:${px(twipsToPx(height))}`;
  if (rule === "atLeast") return `min-height:${px(twipsToPx(height))}`;
  return "";
}

/** حدٌّ واحد ⟵ CSS border-*. val===none ⟵ null. */
function cellBorder(side: BorderSide | null): string | null {
  if (!side || side.wTwips <= 0) return null;
  const style = wordBorderStyle(side.val);
  return `${px(twipsToPx(side.wTwips))} ${style} ${side.color ? "#" + side.color : "#000"}`;
}

function cellBorderCss(b: Borders4 | null): string[] {
  if (!b) return [];
  const out: string[] = [];
  const t = cellBorder(b.top);
  if (t) out.push(`border-top:${t}`);
  const bt = cellBorder(b.bottom);
  if (bt) out.push(`border-bottom:${bt}`);
  const l = cellBorder(b.left);
  if (l) out.push(`border-left:${l}`);
  const r = cellBorder(b.right);
  if (r) out.push(`border-right:${r}`);
  return out;
}

/** يجمع الفقرات المتتالية من جدولٍ واحد إلى TableData. */
export function groupTable(paras: BodyParagraph[]): TableData {
  const first = paras[0]!.tableCell!;
  const totalGridTwips = first.totalGridTwips || 1;
  const rows: TableData["rows"] = [];
  const rowOf = new Map<number, { row: number; cantSplit: boolean; repeatHeader: boolean; rowHeight: number | null; rowHeightRule: string | null; cells: CellData[] }>();
  // فقراتُ w:p المتعددة داخل w:tc واحدة تشترك في سياق (row,col)، ولا تمثل خلايا جديدة.
  const cellAt = new Map<string, CellData>();
  // خليةُ restart رأسي: (row,col) → الخليّة التي تُوسِّعها (لتمديد rowSpan)
  const anchorCell = new Map<string, CellData>();

  for (const p of paras) {
    const cc = p.tableCell!;
    const cellKey = `${cc.row}:${cc.col}`;
    let row = rowOf.get(cc.row);
    if (!row) {
      row = { row: cc.row, cantSplit: cc.cantSplit, repeatHeader: cc.repeatHeader, rowHeight: cc.rowHeight, rowHeightRule: cc.rowHeightRule, cells: [] };
      rowOf.set(cc.row, row);
      rows.push(row);
    }

    const existing = cellAt.get(cellKey);
    if (existing) {
      existing.paras.push(p);
      continue;
    }

    // خليةُ استمرارٍ رأسي: تُوسّع restartَ السابق (في نفس النطاق) — وإلّا خليةٌ فارغة
    if (cc.vMerge === "continue") {
      const prev = anchorCell.get(`${cc.row - 1}:${cc.col}`);
      if (prev) {
        prev.rowSpan++;
        prev.paras.push(p);
        anchorCell.set(`${cc.row}:${cc.col}`, prev);
        cellAt.set(cellKey, prev);
        continue;
      }
      const cont: CellData = { col: cc.col, colSpan: cc.gridSpan ?? 1, rowSpan: 1, paras: [p],
        shdFill: cc.shdFill, vAlign: cc.vAlign, textDirection: cc.textDirection,
        marTop: cc.marTop, marBottom: cc.marBottom, marLeft: cc.marLeft, marRight: cc.marRight,
        borders: cc.tcBorders };
      row.cells.push(cont);
      cellAt.set(cellKey, cont);
      continue;
    }

    const cell: CellData = { col: cc.col, colSpan: cc.gridSpan ?? 1, rowSpan: 1, paras: [p],
      shdFill: cc.shdFill, vAlign: cc.vAlign, textDirection: cc.textDirection,
      marTop: cc.marTop, marBottom: cc.marBottom, marLeft: cc.marLeft, marRight: cc.marRight,
      borders: cc.tcBorders };
    if (cc.vMerge === "restart") anchorCell.set(`${cc.row}:${cc.col}`, cell);
    row.cells.push(cell);
    cellAt.set(cellKey, cell);
  }

  // colSpan لكل خليّة من مواضع الأعمدة في الشبكة (colXTwips)
  const gridBoundaries = new Set<number>();
  for (const r of rows) for (const c of r.cells) gridBoundaries.add(c.paras[0]!.tableCell!.colXTwips);
  const boundaries = [...gridBoundaries].sort((a, b) => a - b);
  for (const r of rows) {
    for (const c of r.cells) {
      const cc = c.paras[0]!.tableCell!;
      const left = cc.colXTwips;
      const right = left + cc.colWTwips;
      c.colSpan = Math.max(c.colSpan, boundaries.filter((b) => b > left && b < right).length + 1);
      r.cells.sort((a, b) => a.col - b.col);
    }
  }
  rows.sort((a, b) => a.row - b.row);
  return { tableId: first.tableId, totalGridTwips, bidiVisual: first.bidiVisual,
    ...(first.parentTableId != null ? { parentTableId: first.parentTableId,
      parentRow: first.parentRow ?? 0, parentCol: first.parentCol ?? 0,
      parentBlockIndex: first.parentBlockIndex ?? 0 } : {}),
    nestingDepth: first.nestingDepth ?? 0,
    tblIndTwips: first.tblIndTwips, tblJc: first.tblJc,
    tblWVal: first.tblWVal, tblWType: first.tblWType,
    tblLayout: first.tblLayout ?? "autofit", rows };
}

/** عرض w:tblW الفعلي بالـtwips؛ pct مقياسه 5000=100٪. */
export function tableWidthTwips(args: {
  available: number; grid: number; value: number; type: string;
}): number {
  const available = Math.max(1, args.available);
  if (args.type === "pct" && args.value > 0) return available * args.value / 5000;
  if (args.type === "dxa" && args.value > 0) return args.value;
  return args.grid > 0 ? args.grid : available;
}

/** نسبة عرض الجدول إلى مساحة الطباعة في مقطع Word.
 * تبقي 50/80/90/100٪ كما ألّفها الملف، ولا تحولها إلى قياس موحد. */
export function tableWidthPercent(tableTwips: number, sectionTwips: number): number {
  return sectionTwips > 0 ? tableTwips * 100 / sectionTwips : 100;
}

/** عرض الخلية من شبكة Word نفسها؛ لا يترك autofit يضغط شطر الشعر. */
export function cellGridWidthPercent(paragraph: BodyParagraph, totalGridTwips: number): number {
  const width = paragraph.tableCell?.colWTwips ?? 0;
  return totalGridTwips > 0 && width > 0 ? width * 100 / totalGridTwips : 0;
}

/**
 * يحاكي «تباعد صغير» في Word بلا إدخال U+0640 أو تغيير النص.
 * يظل الشطر نصًا أصليًا قابلًا للنسخ والبحث، وتتمدد طبقة الرسم فقط حتى
 * حد خلية الشعر. وهذا يطابق أثر Shift+Enter من غير تلويث المحتوى.
 */
export function poetrySmallSpacingScale(naturalWidth: number, cellWidth: number): number {
  if (!(naturalWidth > 0) || !(cellWidth > 0)) return 1;
  return Math.max(1, Math.min(4.5, cellWidth * .92 / naturalWidth));
}

export function poetrySmallKashidaDisplayText(text: string, amount = 1): string {
  const nonJoiningAfter = new Set("ءاأإآدذرزوأؤةى");
  const kashida = "ـ".repeat(Math.max(1, Math.floor(amount)));
  return text.replace(/[\u0620-\u063A\u0641-\u064A]{3,}/gu, word => {
    const candidates: number[] = [];
    for (let index = 0; index < word.length - 1; index++)
      if (!nonJoiningAfter.has(word[index]!)) candidates.push(index + 1);
    if (!candidates.length) return word;
    const at = candidates[Math.floor((candidates.length - 1) / 2)]!;
    return word.slice(0, at) + kashida + word.slice(at);
  });
}

function applyPoetrySmallSpacing(node: HTMLElement, visualKashida = false): void {
  const doc = node.ownerDocument;
  if (!doc?.createElement || node.querySelector(":scope > .word-poetry-line")) return;
  const line = doc.createElement("span");
  line.className = "word-poetry-line";
  line.style.display = "inline-block";
  line.style.whiteSpace = "nowrap";
  line.style.transformOrigin = "right center";
  line.style.willChange = "transform";
  while (node.firstChild) line.appendChild(node.firstChild);
  node.appendChild(line);

  if (visualKashida) {
    // النص المرئي في ::after لا يملك عناصر run الخاصة بـWord، ولذلك كان
    // يرث خط واجهة الموقع بدل Traditional Arabic/الخط المؤلف في المستند.
    // ننقل خصائص الخط فقط إلى غلاف الرسم؛ تبقى الرنات الأصلية والنص القابل
    // للنسخ كما هما، وتَرِث طبقة الكشيدة الشكل الطباعي الصحيح.
    const authoredRun = line.querySelector<HTMLElement>(":scope > .run");
    if (authoredRun) {
      for (const property of ["font-family", "font-size", "font-weight", "font-style",
        "font-variant", "font-stretch", "line-height", "letter-spacing"] as const) {
        const value = authoredRun.style.getPropertyValue(property);
        if (value) line.style.setProperty(property, value);
      }
    }
    const visualText = poetrySmallKashidaDisplayText(node.textContent ?? "");
    if (visualText !== (node.textContent ?? "")) {
      line.classList.add("word-poetry-line--visual-kashida");
      line.dataset.wordVisualText = visualText;
    }
  }

  const fit = (): boolean => {
    if (node.clientWidth <= 0) return false;
    line.style.transform = "none";
    // offsetWidth وclientWidth كلاهما في إحداثيات Word المحلية. استعمال
    // getBoundingClientRect هنا يخلطهما مع scale الصفحة الخارجية، فيضاعف
    // مد الشطر عند تصغير الورقة ويجعله يتجاوز خليته أو يبدو كسطر منفرد.
    let natural = line.offsetWidth;
    // إن استُخدمت كشيدة بصرية، يجب قياس النص المرئي الأطول لا النص الأصلي
    // المخفي؛ وإلا يخرج الرسم من الخلية ويتداخل الصدر والعجز عند تكرار كلمة.
    let visualText = line.dataset.wordVisualText;
    if (visualText) {
      const measure = doc.createElement("span");
      measure.style.cssText = line.style.cssText;
      measure.style.position = "absolute";
      measure.style.visibility = "hidden";
      measure.style.transform = "none";
      measure.style.whiteSpace = "nowrap";
      node.appendChild(measure);
      // Word في «تباعد صغير» يزيد الكشيدة داخل الحروف ولا يمدّ شكل الحرف
      // نفسه. اختر مقدار الكشيدة الذي يملأ الشطر حتى 92٪ من خليته، مع إبقاء
      // النص الأصلي في DOM للنسخ والبحث، ومن دون scaleX يشوّه الخط المؤلف.
      const sourceText = node.textContent ?? "";
      const target = node.clientWidth * .92;
      let bestText = visualText;
      let bestWidth = 0;
      for (let amount = 1; amount <= 24; amount++) {
        const candidate = poetrySmallKashidaDisplayText(sourceText, amount);
        measure.textContent = candidate;
        const width = measure.offsetWidth;
        if (width <= target && width >= bestWidth) {
          bestText = candidate;
          bestWidth = width;
        }
        if (width >= target) break;
      }
      line.dataset.wordVisualText = bestText;
      visualText = bestText;
      measure.textContent = visualText;
      natural = measure.offsetWidth || natural;
      measure.remove();
      line.style.transform = "none";
      line.dataset.wordPoetryScale = "1.0000";
      return true;
    }
    if (natural <= 0) return false;
    const scale = poetrySmallSpacingScale(natural, node.clientWidth);
    line.style.transform = `scaleX(${scale.toFixed(4)})`;
    line.dataset.wordPoetryScale = scale.toFixed(4);
    return true;
  };
  const run = (): void => {
    let attempts = 0;
    const step = (): void => {
      if (fit() || attempts++ >= 8) return;
      if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(step);
    };
    step();
  };
  if (node.clientWidth > 0) run();
  else if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      if (node.clientWidth <= 0) return;
      observer.disconnect();
      run();
    });
    observer.observe(node);
  }
}

/** يبني عناصر فقرات صفحةٍ (خارج الصفحة) — الجداول مجموعةٌ والبقية مفردة. */
export function renderPageBlocks(paras: BodyParagraph[], section: SectionGeometry, ctx: RenderCtx): HTMLElement[] {
  const out: HTMLElement[] = [];
  const tableParas = new Map<number, BodyParagraph[]>();
  for (const paragraph of paras) if (paragraph.tableCell) {
    const owned = tableParas.get(paragraph.tableCell.tableId) ?? [];
    owned.push(paragraph);
    tableParas.set(paragraph.tableCell.tableId, owned);
  }
  const tables = new Map([...tableParas].map(([id, owned]) =>
    [id, groupTable(withRepeatedHeaderRows(owned, ctx.model.paragraphs))] as const));
  // قد تحتوي الصفحة الأولى/الأخيرة من جدول الشعر صفًا واحدًا فقط، فلا تكفي
  // شريحة الصفحة وحدها للتعرّف إلى بنية الصدر/العجز. نحمل شكل الجدول الأصلي
  // للتصنيف فقط، مع إبقاء عناصر الصفحة نفسها كما هي بلا نقل أو دمج.
  const authoredTables = new Map([...tableParas].map(([id, owned]) => {
    // جداول الحواشي والرؤوس قصص مستقلة، ولذلك لا تظهر فقراتها في
    // model.paragraphs (متن المستند). استعمل القصة الكاملة حين تتوفر، وإلا
    // استعمل الفقرات المملوكة للكتلة الحالية بدل تمرير مصفوفة فارغة إلى
    // groupTable وإسقاط الحاشية كلها.
    const authored = ctx.model.paragraphs.filter(paragraph => paragraph.tableCell?.tableId === id);
    return [id, groupTable(authored.length ? authored : owned)] as const;
  }));
  const renderedTables = new Set<number>();
  let i = 0;
  while (i < paras.length) {
    const p = paras[i]!;
    if (!p.tableCell) {
      for (const [fragmentIndex, fragment] of columnFragments(p).entries()) {
        const node = paragraphToElement(fragment, ctx);
        if (node) {
          if (fragmentIndex > 0) node.style.breakBefore = "column";
          out.push(node);
        }
      }
      i++;
      continue;
    }
    // الجداول الأبناء تُركب داخل خلية الأب؛ لا تبقى كتلاً مكررة في تدفق الصفحة.
    const tableId = p.tableCell.tableId;
    i++;
    const table = tables.get(tableId);
    if (!table || renderedTables.has(tableId) || table.parentTableId != null) continue;
    out.push(renderTable(table, section, ctx, tables, renderedTables, authoredTables));
  }
  return out;
}

/** يقسم فقرةً عند w:br type=column مع إبقاء الفواصل خارج النص المرئي.
 * لا نغير عدد فقرات النموذج كي تظل محاذاة WordPageMap وملكية العلامات ثابتة. */
export function columnFragments(paragraph: BodyParagraph): BodyParagraph[] {
  const breaks = [...new Set(paragraph.columnBreakAt ?? [])].sort((a, b) => a - b);
  if (!breaks.length) return [paragraph];
  const runGroups: BodyParagraph["runs"][] = [[]];
  let visibleAt = 0, breakIndex = 0;
  for (const run of paragraph.runs) {
    if (run.hidden) { runGroups[runGroups.length - 1]!.push(run); continue; }
    let start = 0;
    while (breakIndex < breaks.length && breaks[breakIndex]! <= visibleAt + run.text.length) {
      const local = Math.max(start, breaks[breakIndex]! - visibleAt);
      if (local > start) runGroups[runGroups.length - 1]!.push({ ...run, text: run.text.slice(start, local) });
      // المستخرج يضع \n تمثيليًا في موضع w:br؛ CSS column break يحل محله.
      start = run.text[local] === "\n" ? local + 1 : local;
      runGroups.push([]);
      breakIndex++;
    }
    if (start < run.text.length) runGroups[runGroups.length - 1]!.push({ ...run, text: run.text.slice(start) });
    visibleAt += run.text.length;
  }
  return runGroups.map((runs, index) => ({
    ...paragraph,
    runs,
    text: runs.filter(run => !run.hidden).map(run => run.text).join(""),
    columnBreak: false,
    columnBreakAt: [],
    anchors: index === 0 ? paragraph.anchors : [],
    bookmarkIds: index === 0 ? (paragraph.bookmarkIds ?? []) : [],
  }));
}

/** يعيد صفوف رأس الجدول بصريًا في صفحة الاستمرار دون إضافتها إلى نموذج النص. */
export function withRepeatedHeaderRows(slice: BodyParagraph[], all: BodyParagraph[]): BodyParagraph[] {
  const firstCell = slice[0]?.tableCell;
  if (!firstCell || firstCell.row === 0) return slice;
  const headers = all.filter(p => p.tableCell?.tableId === firstCell.tableId && p.tableCell.repeatHeader);
  if (!headers.length) return slice;
  // Word يكرر صفوف الرأس المتتابعة من أعلى الجدول فقط، لا صفًا موسومًا منفردًا في الوسط.
  const rows = [...new Set(headers.map(p => p.tableCell!.row))].sort((a, b) => a - b);
  if (rows[0] !== 0 || rows.some((row, i) => row !== i)) return slice;
  return [...headers, ...slice];
}

/** يبني عنصر <table> من بيانات جدول. */
export function renderTable(
  t: TableData, section: SectionGeometry, ctx: RenderCtx,
  allTables?: ReadonlyMap<number, TableData>, rendered = new Set<number>(),
  authoredTables?: ReadonlyMap<number, TableData>,
): HTMLElement {
  rendered.add(t.tableId);
  const availableTwips = section.columnTwips - t.tblIndTwips;
  const tableTwips = tableWidthTwips({
    available: availableTwips, grid: t.totalGridTwips, value: t.tblWVal, type: t.tblWType,
  });
  const tablePercent = tableWidthPercent(tableTwips, section.columnTwips);
  const authoredShape = authoredTables?.get(t.tableId);
  const poetryShape = isPoetryHemistichTable(t) ? t
    : authoredShape && isPoetryHemistichTable(authoredShape) ? authoredShape : null;
  const poetryTable = poetryShape != null;

  const table = el("table", {
    class: "tbl",
    "data-word-table-id": String(t.tableId),
    "data-word-table-depth": String(t.nestingDepth ?? 0),
    ...(poetryTable ? { "data-word-poetry-table": "true" } : {}),
    ...(t.parentTableId != null ? {
      "data-word-parent-table": String(t.parentTableId),
      "data-word-parent-row": String(t.parentRow),
      "data-word-parent-col": String(t.parentCol),
      "data-word-parent-block": String(t.parentBlockIndex ?? 0),
    } : {}),
    style: css([
      "border-collapse:collapse",
      `width:${tablePercent.toFixed(3)}%`,
      "max-width:none",
      `table-layout:${poetryTable || t.tblLayout === "fixed" ? "fixed" : "auto"}`,
      `direction:${t.bidiVisual ? "rtl" : "ltr"}`,
      t.tblIndTwips ? `margin-inline-start:${px(twipsToPx(t.tblIndTwips))}` : "",
      t.tblJc === "center" ? "margin-inline:auto" : "",
      t.tblJc === "right" ? "margin-left:auto" : "",
      t.tblJc === "left" ? "margin-right:auto" : "",
      t.tblJc === "end" ? "margin-inline-start:auto" : "",
      t.tblJc === "start" ? "margin-inline-end:auto" : "",
      "font-size:12pt",
    ]),
  });

  // colgroup: أعمدـة بنِسَبٍ من مواضع colX (أساسُ tblGrid)
  const colgroup = el("colgroup");
  const boundarySet = new Set<number>([0, t.totalGridTwips]);
  for (const row of t.rows) for (const c of row.cells) {
    const cc = c.paras[0]!.tableCell!;
    boundarySet.add(cc.colXTwips);
    boundarySet.add(cc.colXTwips + cc.colWTwips);
  }
  const b = [...boundarySet].sort((a, z) => a - z);
  const edges: number[] = [];
  for (let k = 0; k < b.length; k++) {
    edges.push(b[k]!);
  }
  for (let k = 0; k < edges.length - 1; k++) {
    const w = Math.max(0, (edges[k + 1]! - edges[k]!) / t.totalGridTwips);
    colgroup.appendChild(el("col", { style: `width:${(w * 100).toFixed(3)}%` }));
  }
  if (!edges.length) colgroup.appendChild(el("col", { style: "width:100%" }));
  table.appendChild(colgroup);

  const thead = el("thead", { style: "display:table-header-group" });
  const tbody = el("tbody");
  for (const row of t.rows) {
    const tr = el("tr", {
      style: css([
        row.cantSplit ? "break-inside:avoid" : "",
        rowHeightCss(row.rowHeight, row.rowHeightRule),
      ]),
    });
    for (const cell of row.cells) {
      const td = el("td", {
        rowspan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
        colspan: cell.colSpan > 1 ? cell.colSpan : undefined,
        style: css([
          "box-sizing:border-box",
          cellGridWidthPercent(cell.paras[0]!, t.totalGridTwips) > 0
            ? `width:${cellGridWidthPercent(cell.paras[0]!, t.totalGridTwips).toFixed(3)}%` : "",
          "vertical-align:" + (cell.vAlign === "center" ? "middle" : cell.vAlign === "bottom" ? "bottom" : "top"),
          cell.textDirection === "tbRl" || cell.textDirection === "tbRlV"
            ? "writing-mode:vertical-rl"
            : cell.textDirection === "btLr" ? "writing-mode:vertical-lr" : "",
          cell.shdFill ? `background-color:#${cell.shdFill}` : "",
          `padding-top:${px(twipsToPx(cell.marTop))}`,
          `padding-bottom:${px(twipsToPx(cell.marBottom))}`,
          `padding-left:${px(twipsToPx(cell.marLeft))}`,
          `padding-right:${px(twipsToPx(cell.marRight))}`,
          ...cellBorderCss(cell.borders),
          // لا يُقص نص الخلية أو الصورة إذا تجاوز قياس الخط ارتفاع Word قليلًا.
          "overflow:visible",
        ]),
      });
      const nested = allTables ? [...allTables.values()].filter(child =>
        child.parentTableId === t.tableId && child.parentRow === row.row && child.parentCol === cell.col) : [];
      const blocks: { index: number; order: number; node: HTMLElement }[] = [];
      for (const child of nested)
        if (!rendered.has(child.tableId)) blocks.push({ index: child.parentBlockIndex ?? 0,
          order: child.tableId, node: renderTable(child, section, ctx, allTables, rendered, authoredTables) });
      for (const p of cell.paras) {
        const node = paragraphToElement(p, ctx);
        if (node) {
          if (poetryShape && isPoetryHemistichParagraph(poetryShape, cell, p)) {
            // HTMLElement الحقيقي يملك الاثنين؛ حارس الاختبار يبقي renderer
            // صالحًا أيضًا مع DOM المصغر الذي لا ينفذ classList/dataset.
            node.classList?.add("word-poetry-hemistich");
            if (node.dataset) node.dataset.wordPoetrySpacing = "small";
            // «تباعد صغير» محدود خاص بالشعر، لا ضبط كامل ولا كشيدة نصية.
            node.style.wordSpacing = "normal";
            // ارتفاع الصف في Word هو المرجع. لا نضيف بعده هامش الفقرة مرة
            // ثانية، وإلا صار الفراغ بين بيتين عدة أسطر بدل سطر واحد.
            node.style.marginTop = "0";
            node.style.marginBottom = "0";
            if (typeof node.style.setProperty === "function") node.style.setProperty("text-justify", "auto");
            else (node.style as unknown as Record<string, string>)["text-justify"] = "auto";
            if (!p.jc || p.jc === "start" || p.jc === "end" || p.jc === "lowKashida"
                || p.jc === "both" || p.jc === "distribute"
                || p.jc === "mediumKashida" || p.jc === "highKashida") {
              node.style.textAlign = "start";
              node.style.textAlignLast = "start";
            }
            const visibleInRow = row.cells.flatMap(candidate => candidate.paras)
              .filter(paragraph => paragraph.text.trim()).length;
            const authoredRows = poetryShape?.rows.length ?? t.rows.length;
            const sliceBoundary = authoredRows > t.rows.length
              && (row === t.rows[0] || row === t.rows.at(-1));
            const standaloneOrSingle = authoredRows === 1 || visibleInRow === 1;
            applyPoetrySmallSpacing(node, sliceBoundary || standaloneOrSingle);
          }
          blocks.push({ index: p.tableCell?.cellBlockIndex ?? Number.MAX_SAFE_INTEGER,
            order: p.index, node });
        }
      }
      for (const block of blocks.sort((a, b) => a.index - b.index || a.order - b.order))
        td.appendChild(block.node);
      tr.appendChild(td);
    }
    (row.repeatHeader ? thead : tbody).appendChild(tr);
  }
  if (thead.children.length) table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}
