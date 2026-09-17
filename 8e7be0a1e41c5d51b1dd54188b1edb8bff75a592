/** ‏ParagraphTable — تحويل فقرات خلايا الجدول المتتالية إلى <table> DOM
 *  (ترجمة مفهومية من `ParagraphTable.dart`): شبكة tblGrid، دمجٌ أفقي (gridSpan)
 *  وعمودي (vMerge)، حدودُ الخلايا، تظليلها، هوامشها، ومحاذاتها العمودية. */

import type { BodyParagraph, BorderSide, Borders4, SectionGeometry } from "@engine/ooxml-model";
import { css, el, px } from "./dom.js";
import { twipsToPx } from "./units.js";
import { paragraphToElement, type RenderCtx } from "./Paragraph.js";
import { wordBorderStyle } from "./BorderCss.js";

interface CellData {
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

interface TableData {
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
    out.push(renderTable(table, section, ctx, tables, renderedTables));
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
): HTMLElement {
  rendered.add(t.tableId);
  const availableTwips = section.columnTwips - t.tblIndTwips;
  const tableTwips = tableWidthTwips({
    available: availableTwips, grid: t.totalGridTwips, value: t.tblWVal, type: t.tblWType,
  });
  const tablePx = twipsToPx(tableTwips);

  const table = el("table", {
    class: "tbl",
    "data-word-table-id": String(t.tableId),
    "data-word-table-depth": String(t.nestingDepth ?? 0),
    ...(t.parentTableId != null ? {
      "data-word-parent-table": String(t.parentTableId),
      "data-word-parent-row": String(t.parentRow),
      "data-word-parent-col": String(t.parentCol),
      "data-word-parent-block": String(t.parentBlockIndex ?? 0),
    } : {}),
    style: css([
      "border-collapse:collapse",
      `width:${px(tablePx)}`,
      `table-layout:${t.tblLayout === "fixed" ? "fixed" : "auto"}`,
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
  const boundarySet = new Set<number>();
  for (const row of t.rows) for (const c of row.cells) boundarySet.add(c.paras[0]!.tableCell!.colXTwips);
  const b = [...boundarySet].sort((a, z) => a - z);
  const edges: number[] = [];
  for (let k = 0; k < b.length; k++) {
    edges.push(b[k]!);
  }
  // حافة الجدول اليمنى = مجموع الشبكة
  if (edges.length) edges.push(t.totalGridTwips);
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
          order: child.tableId, node: renderTable(child, section, ctx, allTables, rendered) });
      for (const p of cell.paras) {
        const node = paragraphToElement(p, ctx);
        if (node) blocks.push({ index: p.tableCell?.cellBlockIndex ?? Number.MAX_SAFE_INTEGER,
          order: p.index, node });
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
