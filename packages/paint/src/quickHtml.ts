/**
 * ترسيم سريع من النموذج مباشرة إلى HTML — بدون buildScene، بدون HarfBuzz، بدون WASM.
 *
 * يدعم: خطوط، أحجام، ألوان، غامق/مائل/تسطير/شطب، محاذاة، مسافات، ترقيم،
 * مسافات بادئة، تظليل، علامات تبويب. الجداول: تجميع أساسي لخلايا متجاورة.
 */

import type { BodyParagraph, DocumentModelV0, FloatAnchor } from "@engine/ooxml-model";

export interface QuickNoteEntry {
  id: string;
  kind: "footnote" | "endnote";
  marker: string | null;
  paragraphs: BodyParagraph[];
}

export function quickParagraphVisible(paragraph: BodyParagraph): boolean {
  return !paragraph.excluded && Boolean(paragraph.text.trim());
}

/** حاشية Word قصةٌ واحدة متعددة الفقرات، ورقمُها يأتي من الإحالة في المتن لا
 * من w:id. كما أن سجلات separator المحجوزة ليست حواشي مستخدم. */
export function quickNoteEntries(model: DocumentModelV0): QuickNoteEntry[] {
  const seen = new Set<string>();
  const entries: QuickNoteEntry[] = [];
  for (const paragraph of model.paragraphs) for (const run of paragraph.runs) {
    const ref = run.noteRef;
    if (!ref?.id) continue;
    const kind = ref.kind === "endnote" ? "endnote" : "footnote";
    const key = `${kind}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const paragraphs = (kind === "endnote" ? model.endnotes : model.footnotes).get(ref.id);
    if (!paragraphs?.length) continue;
    const customMark = ref.custom ? (ref.customMark ?? run.text) : null;
    const authored = customMark
      ? paragraphs.map(item => item.text).join("").trimStart().startsWith(customMark)
      : false;
    entries.push({ id: ref.id, kind, marker: authored ? null : (customMark ?? String(ref.num)), paragraphs });
  }
  return entries;
}

export function renderModelToHtml(model: DocumentModelV0): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = "direction:rtl;font-size:14pt;line-height:1.8";

  const numberingCounters = new Map<string, number>();
  const firstSect = model.sections[0] ?? model.section;

  // ترويسة المقطع الأول (إن وُجدت)
  appendStoryText(root, model, firstSect.headerRefs?.default ?? firstSect.headerRefs?.first);

  // تجميع فقرات الجداول
  const grouped = groupTableParas(model.paragraphs);
  let lastSectionIdx = -1;

  for (const group of grouped) {
    if (group.type === "table") {
      root.appendChild(buildTable(group.paras));
      continue;
    }
    if (group.paras.length === 0) continue;

    for (const para of group.paras) {
      if (para.pageBreakBefore) root.appendChild(hSpacer());

      // صور خالصة (excluded="drawing") أو رموز
      if (para.excluded === "drawing" || para.excluded === "sym") {
        if (para.anchors?.length) renderAnchors(root, para.anchors, model);
        continue;
      }
      if (!quickParagraphVisible(para)) continue;

      const p = buildParagraph(para, numberingCounters);
      if (para.anchors?.length) renderAnchors(p, para.anchors, model);
      root.appendChild(p);
    }
  }

  // تذييل (نفس المقطع)
  appendStoryText(root, model, firstSect.footerRefs?.default ?? firstSect.footerRefs?.first);

  // الحواشي: كل إحالة مدخل واحد، ولو احتوى متنها عدة فقرات.
  const noteEntries = quickNoteEntries(model);
  if (noteEntries.length > 0) {
    const hr = document.createElement("hr");
    hr.style.cssText = "border:none;border-block-start:1px solid #999;margin-block:16pt 8pt;width:50%";
    root.appendChild(hr);
    const counters = new Map<string, number>();
    for (const entry of noteEntries) {
      const note = document.createElement("div");
      note.className = "quick-note-entry";
      note.dataset.note = entry.kind;
      note.dataset.noteId = entry.id;
      note.style.cssText = "display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;column-gap:5px;font-size:10pt;color:#444;direction:rtl";
      const marker = document.createElement("sup");
      marker.className = "quick-note-marker";
      marker.textContent = entry.marker ?? "";
      marker.style.cssText = "font-size:0.72em;line-height:1;min-width:1.2em;text-align:start";
      note.appendChild(marker);
      const body = document.createElement("div");
      body.className = "quick-note-body";
      for (const bp of entry.paragraphs) {
        if (!bp.text.trim()) continue;
        body.appendChild(buildParagraph(bp, counters));
      }
      note.appendChild(body);
      root.appendChild(note);
    }
  }

  return root;
}

function appendStoryText(root: HTMLElement, model: DocumentModelV0, ref: string | undefined): void {
  if (!ref) return;
  const paras = model.headerFooters.get(ref);
  if (!paras) return;
  const wrap = document.createElement("div");
  wrap.style.cssText = "font-size:11pt;color:#666;padding-block:8pt;text-align:center";
  const counters = new Map<string, number>();
  for (const bp of paras) {
    if (bp.text.trim()) {
      wrap.appendChild(buildParagraph(bp, counters));
    }
  }
  root.appendChild(wrap);
}

function hSpacer(): HTMLElement {
  const hr = document.createElement("hr");
  hr.style.cssText = "border:none;border-block-start:2px dashed #ccc;margin-block:12pt";
  return hr;
}

// ---------- grouping ----------

type ParaGroup = { type: "para"; paras: BodyParagraph[] } | { type: "table"; paras: BodyParagraph[] };

/** Word stores every paragraph as a sibling in OOXML, but table identity and
 * row/column coordinates make several siblings one physical cell. */
export function quickTableCellGroups(paragraphs: BodyParagraph[]): BodyParagraph[][] {
  const groups: BodyParagraph[][] = [];
  const byCell = new Map<string, BodyParagraph[]>();
  for (const paragraph of paragraphs) {
    const cell = paragraph.tableCell;
    if (!cell) continue;
    const key = `${cell.tableId}:${cell.row}:${cell.col}`;
    let group = byCell.get(key);
    if (!group) { group = []; byCell.set(key, group); groups.push(group); }
    group.push(paragraph);
  }
  return groups;
}

export interface QuickTableOwnership {
  tableId: number;
  parentTableId?: number;
  parentRow?: number;
  parentCol?: number;
  parentBlockIndex?: number;
  nestingDepth: number;
  paragraphs: BodyParagraph[];
}

/** Keep nested table ownership explicit. Flattening all table paragraphs by row
 * makes an inner table look like extra rows of its outer table. */
export function quickTableOwnership(paragraphs: BodyParagraph[]): QuickTableOwnership[] {
  const tables = new Map<number, QuickTableOwnership>();
  for (const paragraph of paragraphs) {
    const cell = paragraph.tableCell;
    if (!cell) continue;
    let table = tables.get(cell.tableId);
    if (!table) {
      table = {
        tableId: cell.tableId,
        ...(cell.parentTableId != null ? {
          parentTableId: cell.parentTableId,
          parentRow: cell.parentRow,
          parentCol: cell.parentCol,
          parentBlockIndex: cell.parentBlockIndex,
        } : {}),
        nestingDepth: cell.nestingDepth ?? 0,
        paragraphs: [],
      };
      tables.set(cell.tableId, table);
    }
    table.paragraphs.push(paragraph);
  }
  return [...tables.values()];
}

function groupTableParas(paras: BodyParagraph[]): ParaGroup[] {
  const out: ParaGroup[] = [];
  let i = 0;
  while (i < paras.length) {
    if (paras[i]!.tableCell) {
      const table: BodyParagraph[] = [];
      while (i < paras.length && paras[i]!.tableCell) {
        table.push(paras[i]!);
        i++;
      }
      out.push({ type: "table", paras: table });
    } else {
      out.push({ type: "para", paras: [paras[i]!] });
      i++;
    }
  }
  return out;
}

// ---------- images ----------

function renderAnchors(root: HTMLElement, anchors: FloatAnchor[], model: DocumentModelV0): void {
  for (const anc of anchors) {
    if (!anc.rId) continue;
    let target = model.relTargets.get(anc.rId) ?? model.partRels.get("document.xml")?.get(anc.rId);
    if (!target) continue;
    // relTargets يخزّن "media/image1.png" وmediaFiles "image1.png"
    const fileName = target.replace(/^media\//, '');
    let imgData = model.mediaFiles.get(fileName) ?? model.mediaFiles.get(target);
    if (!imgData) continue;
    const img = document.createElement("img");
    img.src = URL.createObjectURL(new Blob([imgData as BlobPart]));
    img.style.cssText = [
      "max-width:100%",
      "height:auto",
      "display:block",
      anc.inlineFlow ? "margin:4px 0" : "margin:8px auto",
    ].join(";");
    root.appendChild(img);
  }
}

// ---------- table ----------

function buildTable(paras: BodyParagraph[]): HTMLElement {
  const ownership = quickTableOwnership(paras);
  const byId = new Map(ownership.map(table => [table.tableId, table]));
  const roots = ownership.filter(table => table.parentTableId == null);
  if (roots.length === 1) return buildOwnedTable(roots[0]!, byId);
  const wrapper = document.createElement("div");
  for (const root of roots) wrapper.appendChild(buildOwnedTable(root, byId));
  return wrapper;
}

function buildOwnedTable(owner: QuickTableOwnership,
  byId: Map<number, QuickTableOwnership>): HTMLElement {
  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;margin-block:6pt";

  // تجميع بالصفوف حسب row
  const rows = new Map<number, BodyParagraph[]>();
  let minRow = Infinity, maxRow = -Infinity;
  for (const p of owner.paragraphs) {
    const tc = p.tableCell!;
    const ri = tc.row;
    if (!rows.has(ri)) rows.set(ri, []);
    rows.get(ri)!.push(p);
    if (ri < minRow) minRow = ri;
    if (ri > maxRow) maxRow = ri;
  }

  for (let ri = minRow; ri <= maxRow; ri++) {
    const rowParas = rows.get(ri);
    if (!rowParas) continue;
    const tr = document.createElement("tr");
    for (const cellParas of quickTableCellGroups(rowParas)) {
      const tc = cellParas[0]!.tableCell!;
      const td = document.createElement("td");
      td.style.cssText = [
        "border:1px solid #ccc",
        `padding:${(tc.marTop / 20).toFixed(1)}pt ${(tc.marRight / 20).toFixed(1)}pt`,
        tc.shdFill ? `background:#${tc.shdFill}` : "",
        "vertical-align:top",
      ].filter(Boolean).join(";");

      const counters = new Map<string, number>();
      const childTables = [...byId.values()].filter(child =>
        child.parentTableId === owner.tableId && child.parentRow === tc.row && child.parentCol === tc.col);
      const blocks: { index: number; order: number; node: HTMLElement }[] = [];
      for (const paragraph of cellParas) if (quickParagraphVisible(paragraph)) blocks.push({
        index: paragraph.tableCell?.cellBlockIndex ?? Number.MAX_SAFE_INTEGER,
        order: paragraph.index,
        node: buildParagraph(paragraph, counters),
      });
      for (const child of childTables) blocks.push({
        index: child.parentBlockIndex ?? 0,
        order: child.tableId,
        node: buildOwnedTable(child, byId),
      });
      blocks.sort((a, b) => a.index - b.index || a.order - b.order);
      for (const block of blocks) td.appendChild(block.node);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  return table;
}

// ---------- paragraph ----------

function buildParagraph(para: BodyParagraph, counters: Map<string, number>): HTMLElement {
  const p = document.createElement("p");

  const spacingBefore = twipsToPt(para.spacing.before ?? 0);
  const spacingAfter = twipsToPt(para.spacing.after ?? 0);
  const indLeft = twipsToPt(para.indLeft);
  const indRight = twipsToPt(para.indRight);
  const indFirstLine = twipsToPt(para.indFirstLine);

  // ارتفاع السطر حسب قاعدة Word: line/240 للـ auto، line/20 للـ exact/atLeast
  const lineHeightCss = quickParagraphLineHeight(para);
  const dir: "rtl" | "ltr" = para.bidi ? "rtl" : firstStrongDir(para.text);

  const css: string[] = [
    "margin:0",
    `margin-block-start:${Math.max(0, spacingBefore)}pt`,
    `margin-block-end:${Math.max(0, spacingAfter)}pt`,
    // w:left/w:right are physical page edges even in a bidi paragraph.
    `padding-left:${indLeft}pt`,
    `padding-right:${indRight}pt`,
    `text-indent:${indFirstLine}pt`,
    `text-align:${jcCss(para.jc)}`,
    `direction:${dir}`,
    "unicode-bidi:embed",
    `line-height:${lineHeightCss}`,
  ];

  // تظليل الخلفية
  if (para.shd) {
    css.push(`background:#${para.shd}`);
    css.push(`padding:4pt`);
  }

  p.style.cssText = css.join(";");

  // علامة الترقيم
  if (para.numbered) {
    const key = para.numId ?? "__null";
    const seq = (counters.get(key) ?? 0) + 1;
    counters.set(key, seq);
    const marker = document.createElement("span");
    marker.textContent = `${seq}. `;
    marker.style.cssText = "font-weight:bold;margin-inline-end:4pt";
    p.appendChild(marker);
  }

  // جدول المحتويات (TOC)
  if (para.toc) {
    const tocLine = document.createElement("div");
    tocLine.style.cssText = [
      "direction:rtl",
      "display:flex",
      "justify-content:space-between",
      "gap:8px",
    ].join(";");
    const left = document.createElement("span");
    left.textContent = para.toc.entry ?? para.text;
    const right = document.createElement("span");
    right.textContent = String(para.toc.pageNum ?? '');
    right.style.cssText = "white-space:nowrap";
    // نقاط القائد
    if (para.toc.leader && para.toc.leader !== 'none') {
      const dots = document.createElement("span");
      dots.style.cssText = "flex:1;text-align:center;overflow:hidden;direction:ltr";
      dots.textContent = '·'.repeat(40);
      tocLine.appendChild(left);
      tocLine.appendChild(dots);
      tocLine.appendChild(right);
    } else {
      tocLine.appendChild(left);
      tocLine.appendChild(right);
    }
    p.appendChild(tocLine);
    return p;
  }

  // الـ runs
  for (const run of para.runs) {
    if (!run.text && !run.fieldResult) continue;
    // معالجة علامات التبويب في النص
    let text = run.text ?? '';
    text = text.replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0\u00A0');
    if (run.fieldResult === 'PAGE') text = '١';
    else if (run.fieldResult === 'NUMPAGES') text = '١';

    const span = document.createElement("span");
    if (run.href) {
      // رابط تشعبي
      const a = document.createElement("a");
      a.textContent = text;
      a.href = run.href.startsWith("http") ? run.href : `#/reader/${run.href}`;
      a.target = run.href.startsWith("http") ? "_blank" : "_self";
      a.style.cssText = "color:#1a73e8;text-decoration:underline;cursor:pointer";
      span.appendChild(a);
    } else if (run.superscript || run.noteRef) {
      const sup = document.createElement("sup");
      sup.textContent = run.noteRef?.custom
        ? (run.noteRef.customMark ?? text)
        : (text || String(run.noteRef?.num ?? ''));
      sup.style.cssText = "font-size:0.7em;vertical-align:super";
      span.appendChild(sup);
    } else {
      span.textContent = text;
    }
    const scss: string[] = [];
    const family = run.family ?? "Traditional Arabic";
    scss.push(`font-family:'${family.replace(/'/g, "")}','Traditional Arabic','Times New Roman',serif`);
    if (run.emTwips) scss.push(`font-size:${(run.emTwips / 20).toFixed(1)}pt`);
    if (run.bold) scss.push("font-weight:bold");
    if (run.italic) scss.push("font-style:italic");
    if (run.color) scss.push(`color:#${run.color}`);
    if (run.underline && run.underline !== "none") scss.push("text-decoration:underline");
    if (run.strike) scss.push("text-decoration:line-through");
    span.style.cssText = scss.join(";");
    p.appendChild(span);
  }

  return p;
}

// ---------- helpers ----------

export function quickParagraphLineHeight(para: BodyParagraph): string {
  const line = para.spacing.line;
  if (line == null || line <= 0) return "1.8";
  if (para.spacing.lineRule === "exact") return `${line / 20}pt`;
  if (para.spacing.lineRule === "atLeast") return `${Math.max(line / 20, 10)}pt`;
  return line < 240 ? "normal" : String(line / 240);
}

export function jcCss(jc: string | null): string {
  if (jc === "center") return "center";
  if (jc === "left") return "left";
  if (jc === "right") return "right";
  if (jc === "both" || jc === "distribute" || jc === "thaiDistribute"
      || jc === "lowKashida" || jc === "mediumKashida" || jc === "highKashida") return "justify";
  if (jc === "end") return "end";
  return "start";
}

function twipsToPt(twips: number): number {
  return twips / 20;
}

/** أول حرف قوي الاتجاه في النص — يحدد اتجاه الفقرة الافتراضي. */
function firstStrongDir(text: string): "rtl" | "ltr" {
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) ?? 0;
    if (cp >= 0x0590 && cp <= 0x08FF) return "rtl";
    if (cp >= 0xFB50 && cp <= 0xFEFC) return "rtl";
    if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A)) return "ltr";
    if (cp >= 0x0030 && cp <= 0x0039) continue; // أرقام محايدة
  }
  return "rtl";
}
