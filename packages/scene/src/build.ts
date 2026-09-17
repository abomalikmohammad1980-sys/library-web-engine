/**
 * ‏buildScene — تحويل DocumentModelV0 إلى SceneDocument:
 *  - حلّ الخطوط عبر المورّد وتجميعها (مرة لكل وجه)
 *  - تقسيم فقرات المتن إلى كلمات مُشكّلة (كل كلمة تُشكّل منفردة — لا تراكيب
 *    تعبر المسافات، وهذا مطابق لتشكيل الرنّات المتصلة عمليًا)
 *  - قياس الكلمات بـ twips كسرية (مقاييس HB الكسرية هي النموذج الأصح — الحقيقة)
 *  - كسر الأسطر بـ `breakLines` (greedy + القاعدة 16)
 *  - التدفّق العمودي: ارتفاع السطر من مقاييس الخط + w:spacing + تقسيم الفقرات
 *    المتجاوزة أسفل الصفحة إلى صفحات متصلة
 *
 * المحدوديات المعلنة (v1): بعض الحقول المركبة وw:ptab/tab مواقفُ تبويب لا
 * تُعالج بعد. فواصل w:br اليدوية والأرملة/اليتيم مفعّلة في المسار الحالي.
 */

import type { DocumentModelV0, BodyParagraph, SectionGeometry } from "@engine/ooxml-model";
import type { FontProvider } from "@engine/font-system";
import { fontRequest } from "@engine/font-system";
import { Shaper } from "@engine/shaper";
import { computeLevels, visualRunOrder } from "@engine/bidi";
import { breakLines, type BreakItem } from "@engine/layout";
import {
  type Direction, type SceneDocument, type SceneFont, type SceneGlyph, type SceneLine,
  type SceneLook, type ScenePage, type SceneParagraph, type SceneWord, highlightHex,
  type BuildOptions,
} from "./types.js";
import type { SceneTableFragment, SceneTableRow, SceneTableSource } from "./types.js";

export interface BuildContext {
  shaper: Shaper;
  provider: FontProvider;
  fonts: SceneFont[];
  fontIndex: Map<string, number>;
  defaultEmTwips: number;
  defaultTabStopTwips: number;
  spaceAdv: Map<number, number>;
  compatibilityMode: number;
  numberingState: Map<string, number>;
  numbering: DocumentModelV0["numbering"];
  cooperate: (force?: boolean) => Promise<void>;
}

export class SceneBuildLimitError extends Error {
  readonly code: "aborted" | "timeout";
  constructor(code: "aborted" | "timeout") {
    super(code === "aborted" ? "scene_build_aborted" : "scene_build_timeout");
    this.name = "SceneBuildLimitError";
    this.code = code;
  }
}

interface ParagraphPageOwner { pageIndex: number; yTwips: number }
interface SquareWrapExclusion {
  left: number; right: number; top: number; bottom: number;
  side: NonNullable<BodyParagraph["anchors"][number]["wrapSide"]>;
  polygon?: { x: number; y: number }[];
}

/**
 * يحوّل مضلع wp:wrapPolygon إلى حدود أفقية عند سطر بعينه. إحداثيات المضلع
 * محلية للشكل (غالبًا 0..21600)، لذلك نطبّعها من حدود المضلع نفسها ثم نعيد
 * إسقاطها داخل extent المرساة. إن لم يقطع السطر ضلعين على الأقل نعود إلى
 * مستطيل المرساة، وهو fallback Word المحافظ للأشكال التالفة.
 */
export function tightWrapHorizontalBounds(
  polygon: readonly { x: number; y: number }[] | undefined,
  top: number, bottom: number, left: number, right: number, lineY: number,
): { left: number; right: number } {
  if (!polygon || polygon.length < 3 || bottom <= top || right <= left)
    return { left, right };
  const xs = polygon.map(point => point.x), ys = polygon.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  if (maxX <= minX || maxY <= minY) return { left, right };
  const polygonY = minY + Math.max(0, Math.min(1, (lineY - top) / (bottom - top))) * (maxY - minY);
  const intersections: number[] = [];
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index]!, b = polygon[(index + 1) % polygon.length]!;
    if ((a.y <= polygonY && b.y > polygonY) || (b.y <= polygonY && a.y > polygonY))
      intersections.push(a.x + ((polygonY - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  if (intersections.length < 2) return { left, right };
  const polygonLeft = Math.min(...intersections), polygonRight = Math.max(...intersections);
  const scale = (right - left) / (maxX - minX);
  return { left: left + (polygonLeft - minX) * scale, right: left + (polygonRight - minX) * scale };
}

export function squareWrapTextRegion(
  side: SquareWrapExclusion["side"], dir: Direction,
  columnLeft: number, columnRight: number, exclusionLeft: number, exclusionRight: number,
): { left: number; right: number } | null {
  const left = { left: columnLeft, right: Math.min(columnRight, exclusionLeft) };
  const right = { left: Math.max(columnLeft, exclusionRight), right: columnRight };
  const lw = left.right - left.left, rw = right.right - right.left;
  const validLeft = lw > 0, validRight = rw > 0;
  if (!validLeft && !validRight) return null;
  if (side === "left") return validLeft ? left : null;
  if (side === "right") return validRight ? right : null;
  if (side === "largest") return (!validRight || (validLeft && lw >= rw)) ? left : right;
  // bothSides يسمح الجهتين؛ يبدأ التدفق من جهة بداية الفقرة، ثم البديل إن ضاقت.
  return dir === "rtl" ? (validRight ? right : left) : (validLeft ? left : right);
}

export async function buildScene(
  model: DocumentModelV0,
  provider: FontProvider,
  opts: BuildOptions = {},
): Promise<SceneDocument> {
  const startedAt = performance.now();
  const budgetMs = Math.max(1, opts.cooperativeBudgetMs ?? 16);
  const maxElapsedMs = opts.maxElapsedMs == null
    ? Number.POSITIVE_INFINITY : Math.max(1, opts.maxElapsedMs);
  const yieldControl = opts.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  let lastYieldAt = startedAt;
  const cooperate = async (force = false): Promise<void> => {
    if (opts.signal?.aborted) throw new SceneBuildLimitError("aborted");
    const now = performance.now();
    if (now - startedAt > maxElapsedMs) throw new SceneBuildLimitError("timeout");
    if (!force && now - lastYieldAt < budgetMs) return;
    await yieldControl();
    lastYieldAt = performance.now();
    if (opts.signal?.aborted) throw new SceneBuildLimitError("aborted");
    if (lastYieldAt - startedAt > maxElapsedMs) throw new SceneBuildLimitError("timeout");
  };
  const ctx: BuildContext = {
    shaper: new Shaper(),
    provider,
    fonts: [],
    fontIndex: new Map(),
    defaultEmTwips: opts.defaultEmTwips ?? 240,
    defaultTabStopTwips: model.defaultTabStop || 720,
    spaceAdv: new Map(),
    compatibilityMode: model.compatibilityMode,
    numberingState: new Map(),
    numbering: model.numbering ?? new Map(),
    cooperate,
  };
  const maxPages = Math.max(1, Math.floor(opts.maxPages ?? 2000));

  const pages: ScenePage[] = [];
  /** الحد السفلي الفعلي للمتن بعد احتساب تذييل الصفحة المختار. */
  const pageBodyBottom = new Map<number, number>();
  const paginationSectionPageNo = new Map<number, number>();
  let paginationPreviousLogicalPageNumber = 0;
  let page: ScenePage | null = null;
  let y = 0;
  let firstOnPage = true;
  let prevAfter = 0;
  let prevStyleId: string | null = null;
  let prevContextualSpacing = false;

  const paragraphBoundaryGap = (p: BodyParagraph, before: number): number => {
    if (firstOnPage) return 0;
    const sameStyle = Boolean(p.styleId && prevStyleId && p.styleId === prevStyleId);
    const after = sameStyle && prevContextualSpacing ? 0 : prevAfter;
    const effectiveBefore = sameStyle && p.contextualSpacing ? 0 : before;
    return Math.max(after, effectiveBefore);
  };

  const newPage = async (s: SectionGeometry): Promise<ScenePage> => {
    const pg: ScenePage = {
      index: pages.length,
      sectionIndex: Math.max(0, model.sections.indexOf(s)),
      widthTwips: s.pageWTwips,
      heightTwips: s.pageHTwips,
      marLeftTwips: s.marLeftTwips,
      marRightTwips: s.marRightTwips,
      marTopTwips: s.marTopTwips,
      marBottomTwips: s.marBottomTwips,
      ...(model.pageBackground ? { backgroundColor: model.pageBackground } : {}),
      paragraphs: [],
      tables: [],
      anchors: [],
    };
    pages.push(pg);
    const ordinal = (paginationSectionPageNo.get(pg.sectionIndex) ?? 0) + 1;
    paginationSectionPageNo.set(pg.sectionIndex, ordinal);
    const savedStart = paginationPreviousLogicalPageNumber === 0 && s.pgNumStart == null
      ? savedInitialPageNumber(model, s) : null;
    const logicalPageNumber = ordinal === 1
      ? (s.pgNumStart ?? savedStart ?? paginationPreviousLogicalPageNumber + 1)
      : paginationPreviousLogicalPageNumber + 1;
    paginationPreviousLogicalPageNumber = logicalPageNumber;
    const refType = s.titlePg && ordinal === 1 ? "first"
      : model.evenAndOddHeaders && logicalPageNumber % 2 === 0 ? "even" : "default";
    // first/even جزءان مستقلان في Word. غياب مرجعهما (بعد اكتمال وراثة
    // المقاطع في model) يعني رأسًا فارغًا، لا سقوطًا إلى default.
    const headerRef = refType === "first" ? s.headerRefs?.first
      : refType === "even" ? (s.headerRefs?.even ?? s.headerRefs?.default)
      : s.headerRefs?.default;
    const headerSource = headerRef ? model.headerFooters.get(headerRef) : undefined;
    y = headerSource ? headerBodyClearance(pg, headerSource, s) : s.marTopTwips;
    const footerRef = refType === "first" ? s.footerRefs?.first
      : refType === "even" ? (s.footerRefs?.even ?? s.footerRefs?.default)
      : s.footerRefs?.default;
    const footerSource = footerRef ? model.headerFooters.get(footerRef) : undefined;
    if (footerSource) {
      // قياس التذييل لا يجوز أن يغيّر عدادات قوائم المتن. كما أن حفظ الناتج
      // هنا يمنع إعادة تشكيله لاحقًا ويجعل العرض التدريجي يرى التذييل فورًا.
      const numberingSnapshot = new Map(ctx.numberingState);
      pg.footerParas = await buildMarginParas(
        footerSource, s, ctx, pg.heightTwips - (s.footerDistTwips ?? 720), true,
      );
      ctx.numberingState = numberingSnapshot;
      pageBodyBottom.set(pg.index, footerBodyClearance(pg, footerSource, pg.footerParas, s));
    } else pageBodyBottom.set(pg.index, pg.heightTwips - pg.marBottomTwips);
    firstOnPage = true;
    prevAfter = 0;
    prevStyleId = null;
    prevContextualSpacing = false;
    // عرض كل صفحة حال اكتمالها + سماح للمتصفح بالرسم
    opts.onPage?.(pg, { pages: [pg], fonts: ctx.fonts });
    await cooperate(true);
    return pg;
  };

  let totalParas = 0;
  for (const p of model.paragraphs) if (isRenderableParagraph(p) || (p.excluded === "drawing" && p.anchors?.length)) totalParas++;
  let paraCount = 0;
  const tableSources = groupSceneTableSources(model.paragraphs);
  const tableSourcesById = new Map(tableSources.map(table => [table.tableId, table]));
  const tableRows = new Map<string, SceneTableSource["rows"][number]>();
  for (const table of tableSources) for (const row of table.rows)
    tableRows.set(`${table.tableId}:${row.row}`, row);
  const handledRows = new Set<string>();
  /** صفوف الرأس المتصلة في بداية كل جدول، بعد قياسها الحقيقي مرة واحدة. */
  const repeatedTableHeaders = new Map<number, SceneTableRow[]>();
  const paragraphPage = new Map<number, ParagraphPageOwner>();
  const pageWraps = new Map<number, SquareWrapExclusion[]>();
  const nextFlowParagraph = nextRenderableParagraphIndexes(model.paragraphs);
  pagination: for (let paragraphIndex = 0; paragraphIndex < model.paragraphs.length; paragraphIndex++) {
    await cooperate();
    const p = model.paragraphs[paragraphIndex]!;
    const section = model.sections[p.sectionIndex] ?? model.section;
    const explicitBoundaries = p.pageBreaksBefore ?? (p.pageBreakBefore ? 1 : 0);
    if (page === null) page = await newPage(section);
    for (let boundary = 0; boundary < explicitBoundaries; boundary++) {
      if (pages.length >= maxPages) break pagination;
      page = await newPage(section);
    }
    paragraphPage.set(paragraphIndex, { pageIndex: page.index, yTwips: y });
    for (const anchor of p.anchors ?? []) {
      if (anchor.inlineFlow || !["Square", "Tight", "Through"].includes(anchor.wrap)
        || !anchor.wrapSide) continue;
      const anchorPage = pages[Math.max(0, page.index + (anchor.pageOffset ?? 0))] ?? page;
      const pos = anchorPagePosition(anchor, anchorPage, section, y);
      const exclusions = pageWraps.get(anchorPage.index) ?? [];
      exclusions.push({ left: pos.x - anchor.distL, right: pos.x + anchor.extentW + anchor.distR,
        top: pos.y - anchor.distT, bottom: pos.y + anchor.extentH + anchor.distB,
        side: anchor.wrapSide,
        ...(["Tight", "Through"].includes(anchor.wrap) && anchor.wrapPolygon?.length
          ? { polygon: anchor.wrapPolygon } : {}),
      });
      pageWraps.set(anchorPage.index, exclusions);
    }
    // الصور: حتى لو excluded="drawing" نمرّر مراسيها للصفحة
    if ((p.excluded === "drawing" || p.excluded === "sym") && p.anchors?.length) {
      // الملكية بالصفحة سُجلت أعلاه؛ الإنشاء الموحد بعد اكتمال التصفيح يمنع
      // تكرار المرساة أو اختلاق صفحة مستقلة لفقرة رسم عائمة.
      continue;
    }
    if (p.tableCell) {
      if (p.tableCell.parentTableId != null) continue;
      const rowKey = `${p.tableCell.tableId}:${p.tableCell.row}`;
      if (handledRows.has(rowKey)) continue;
      handledRows.add(rowKey);
      const rowSource = tableRows.get(rowKey);
      if (!rowSource) continue;
      const rowTop = y + (firstOnPage ? 0 : prevAfter);
      let row = await buildSceneTableRow(rowSource, section, ctx, rowTop, tableSourcesById);
      if (row.repeatHeader) {
        const headers = repeatedTableHeaders.get(row.tableId) ?? [];
        if (row.row === headers.length) {
          headers.push(cloneSceneTableRow(row));
          repeatedTableHeaders.set(row.tableId, headers);
        }
      }
      const bottom = pageBodyBottom.get(page.index) ?? page.heightTwips - page.marBottomTwips;
      const repeatedHeaderHeight = row.repeatHeader ? 0
        : (repeatedTableHeaders.get(row.tableId) ?? []).reduce((sum, header) => sum + header.hTwips, 0);
      const decision = tableRowPageDecision(row.hTwips, bottom - rowTop,
        bottom - page.marTopTwips - repeatedHeaderHeight, row.cantSplit);
      if (decision === "move") {
        if (pages.length >= maxPages) break pagination;
        page = await newPage(section);
        const headerBottom = row.repeatHeader ? page.marTopTwips
          : appendRepeatedTableHeaders(page, repeatedTableHeaders.get(row.tableId), page.marTopTwips);
        shiftSceneTableRow(row, headerBottom - row.yTwips);
      }
      if (decision === "split") {
        let offset = 0;
        y = rowTop;
        while (offset < row.hTwips) {
          const capacity = (pageBodyBottom.get(page.index)
            ?? page.heightTwips - page.marBottomTwips) - y;
          if (capacity <= 0) {
            if (pages.length >= maxPages) break pagination;
            page = await newPage(section);
            y = appendRepeatedTableHeaders(page,
              row.repeatHeader ? undefined : repeatedTableHeaders.get(row.tableId), page.marTopTwips);
            continue;
          }
          const fragmentHeight = tableRowFragmentHeight(row, offset, capacity);
          const fragment = sliceSceneTableRow(row, offset, fragmentHeight, y);
          appendSceneTableRow(page, fragment);
          offset += fragment.hTwips;
          y += fragment.hTwips;
          if (offset < row.hTwips) {
            if (pages.length >= maxPages) break pagination;
            page = await newPage(section);
            y = appendRepeatedTableHeaders(page,
              row.repeatHeader ? undefined : repeatedTableHeaders.get(row.tableId), page.marTopTwips);
          }
        }
        firstOnPage = false; prevAfter = 0; prevStyleId = null; prevContextualSpacing = false;
        continue;
      }
      appendSceneTableRow(page, row);
      y = row.yTwips + row.hTwips;
      firstOnPage = false; prevAfter = 0; prevStyleId = null; prevContextualSpacing = false;
      continue;
    }
    if (!isRenderableParagraph(p)) continue;
    if (!p.text.trim()) continue;
    paraCount++;
    opts.onProgress?.(paraCount, totalParas, 'تشكيل النص ورصف الصفحات…')
    if (page.widthTwips !== section.pageWTwips ||
        page.heightTwips !== section.pageHTwips) {
      if (pages.length >= maxPages) break pagination;
      page = await newPage(section);
    }
    const pg = page as ScenePage;
    let paragraphSection = section;
    const candidateTop = y + paragraphBoundaryGap(p, p.spacing.before ?? 0);
    const exclusion = (pageWraps.get(page.index) ?? [])
      .find(candidate => candidateTop >= candidate.top && candidateTop < candidate.bottom);
    if (exclusion) {
      const dir: Direction = p.bidi ? "rtl" : firstStrongDirection(p.text);
      const bounds = tightWrapHorizontalBounds(exclusion.polygon, exclusion.top, exclusion.bottom,
        exclusion.left, exclusion.right, candidateTop);
      const region = squareWrapTextRegion(exclusion.side, dir, section.marLeftTwips,
        section.pageWTwips - section.marRightTwips, bounds.left, bounds.right);
      if (region && region.right - region.left > p.indLeft + p.indRight) paragraphSection = { ...section, marLeftTwips: region.left,
        marRightTwips: section.pageWTwips - region.right,
        columnTwips: region.right - region.left, colWidthTwips: region.right - region.left };
      else y = Math.max(y, exclusion.bottom);
    }
    const built = await buildParagraph(p, paragraphSection, ctx);
    if (!built) continue;

    const pageBottom = pageBodyBottom.get(pg.index) ?? pg.heightTwips - pg.marBottomTwips;
    const gapAbove = paragraphBoundaryGap(p, built.spacingBeforeTwips);
    const paraH = built.lineHeightTwips;
    let nextFirstWithGap = 0;
    if (p.keepNext) {
      const nextIndex = nextFlowParagraph[paragraphIndex] ?? -1;
      const next = nextIndex >= 0 ? model.paragraphs[nextIndex] : undefined;
      const nextBoundaries = next ? (next.pageBreaksBefore ?? (next.pageBreakBefore ? 1 : 0)) : 0;
      if (next && next.sectionIndex === p.sectionIndex && nextBoundaries === 0) {
        const numberingSnapshot = new Map(ctx.numberingState);
        const preview = await buildParagraph(next, section, ctx);
        ctx.numberingState = numberingSnapshot;
        if (preview?.para.lines[0]) {
          const sameStyle = Boolean(p.styleId && next.styleId && p.styleId === next.styleId);
          const after = sameStyle && p.contextualSpacing ? 0 : built.spacingAfterTwips;
          const before = sameStyle && next.contextualSpacing ? 0 : preview.spacingBeforeTwips;
          nextFirstWithGap = Math.max(after, before) + preview.para.lines[0].heightTwips;
        }
      }
    }
    const remaining = pageBottom - (y + gapAbove);
    const freshCapacity = pageBottom - pg.marTopTwips;
    if (!firstOnPage && keptParagraphNeedsFreshPage(
      remaining, freshCapacity, paraH, nextFirstWithGap, Boolean(p.keepLines), Boolean(p.keepNext))) {
      if (pages.length >= maxPages) break pagination;
      page = await newPage(section);
      y = page.marTopTwips;
      prevAfter = 0;
      prevStyleId = null;
      prevContextualSpacing = false;
      firstOnPage = true;
    }
    const targetPage = page as ScenePage;
    const effectiveGap = paragraphBoundaryGap(p, built.spacingBeforeTwips);

    if (targetPage.heightTwips - targetPage.marBottomTwips - (y + effectiveGap) >= paraH) {
      placeLines(targetPage, built.para, built.para.lines, y + effectiveGap);
      y = y + effectiveGap + paraH;
      prevAfter = built.spacingAfterTwips;
      prevStyleId = p.styleId;
      prevContextualSpacing = Boolean(p.contextualSpacing);
      firstOnPage = false;
    } else {
      // تقسيم الفقرة على صفحات متصلة
      let queue = built.para.lines.slice();
      let top = y + gapAbove;
      while (queue.length > 0) {
        const bottom = pageBodyBottom.get(page!.index)
          ?? page!.heightTwips - page!.marBottomTwips;
        let fit = 0;
        let ly = top;
        while (fit < queue.length && ly + queue[fit]!.heightTwips <= bottom) {
          ly += queue[fit]!.heightTwips;
          fit++;
        }
        fit = widowOrphanLineFit(fit, queue.length,
          top <= page!.marTopTwips + 0.01, p.widowControl);
        if (fit === 0) {
          // لا يتسع السطر الأول في المتبقي — صفحة جديدة بدل التراكم على نفس الصفحة
          if (top > page!.marTopTwips) {
            if (pages.length >= maxPages) break pagination;
            page = await newPage(section);
            top = page.marTopTwips;
            continue;
          }
          fit = 1; // السطر أطول من منطقة الصفحة كلها — حارس: يُرسل ويُقصّ
        }
        const segLines = queue.splice(0, fit);
        placeLines(page!, built.para, segLines, top);
        y = top + sumHeights(segLines);
        firstOnPage = false;
        if (queue.length === 0) {
          prevAfter = built.spacingAfterTwips;
          prevStyleId = p.styleId;
          prevContextualSpacing = Boolean(p.contextualSpacing);
          break;
        }
        if (pages.length >= maxPages) break pagination;
        page = await newPage(section);
        top = page.marTopTwips;
      }
    }
  }
  // ربط الصور/الأشكال: لكل فقرة في النموذج، نمرّر مراسيها إلى الصفحة المناسبة
  const { mediaFiles, relTargets, partRels } = model;
  for (let paragraphIndex = 0; paragraphIndex < model.paragraphs.length; paragraphIndex++) {
    const p = model.paragraphs[paragraphIndex]!;
    if (!p.anchors?.length) continue;
    for (const anc of p.anchors) {
      if (anc.part) continue; // ترويسات/تذييلات — مرحلة لاحقة
      let imageData: Uint8Array | null = null;
      if (anc.rId) {
        const rels = partRels.get("document.xml") ?? relTargets;
        const target = rels.get(anc.rId);
        if (target) imageData = mediaFiles.get(target) ?? null;
      }
      // تحديد الصفحة: المرساة العائمة توضع على الصفحة الأولى مؤقتًا
      // (التوزيع الدقيق على الصفحات يتطلب معرفة الصفحة التي يظهر فيها
      //  مرجع الفقرة — مرحلة لاحقة للعائمات المعقدة)
      const owner = paragraphPage.get(paragraphIndex);
      const pageIdx = Math.max(0, (owner?.pageIndex ?? 0) + (anc.pageOffset ?? 0));
      const pg = pages[pageIdx] ?? pages[0];
      if (!pg) continue;
      // حساب الموضع: posVOffset بالنسبة للهامش العلوي أو حافة الصفحة
      const anchorSection = model.sections[p.sectionIndex] ?? model.section;
      const positioned = anchorPagePosition(anc, pg, anchorSection, owner?.yTwips ?? pg.marTopTwips);
      let x = positioned.x;
      let y = positioned.y;
      const ins = anc.boxIns ?? { l: 144, t: 72, r: 144, b: 72 };
      const contentW = Math.max(1, anc.extentW - ins.l - ins.r);
      const boxSection = { ...anchorSection, marLeftTwips: x + ins.l,
        marRightTwips: Math.max(0, anchorSection.pageWTwips - x - anc.extentW + ins.r),
        columnTwips: contentW, colWidthTwips: contentW, colCount: 1 };
      const textBoxParas = anc.textBox?.length
        ? await buildMarginParas(anc.textBox, boxSection, ctx, y + ins.t, false) : undefined;
      if (textBoxParas?.length && (anc.boxAnchor === "ctr" || anc.boxAnchor === "b")) {
        const firstTop = Math.min(...textBoxParas.map(paragraph => paragraph.yTwips));
        const lastBottom = Math.max(...textBoxParas.flatMap(paragraph => paragraph.lines)
          .map(line => line.yTwips - line.ascentTwips + line.heightTwips));
        const free = Math.max(0, anc.extentH - ins.t - ins.b - (lastBottom - firstTop));
        const shift = anc.boxAnchor === "ctr" ? free / 2 : free;
        for (const paragraph of textBoxParas) {
          paragraph.yTwips += shift;
          for (const line of paragraph.lines) line.yTwips += shift;
        }
      }
      const groupChildren = sceneGroupChildren(anc, model, x, y)
        ?? sceneDiagramChildren(anc, x, y);
      pg.anchors.push({
        xTwips: Math.max(0, x),
        yTwips: Math.max(0, y),
        wTwips: anc.extentW,
        hTwips: anc.extentH,
        imageData,
        behindDoc: anc.behindDoc,
        floating: !anc.inlineFlow,
        zOrder: anc.zOrder,
        shapeFill: groupChildren ? null : anc.shape?.fill ?? null,
        shapeStroke: groupChildren ? null : anc.shape?.stroke ?? null,
        shapePrst: groupChildren ? null : anc.shape?.prst ?? null,
        ...(!groupChildren && anc.shape?.strokeW != null ? { shapeStrokeWTwips: anc.shape.strokeW } : {}),
        ...(!groupChildren && anc.shape?.gradient ? { shapeGradient: anc.shape.gradient } : {}),
        ...(!groupChildren && anc.shape?.adj != null ? { shapeAdj: anc.shape.adj } : {}),
        ...(anc.chart ? { chart: anc.chart } : {}),
        ...(anc.imageEffects?.shadow ? { imageShadow: anc.imageEffects.shadow } : {}),
        ...(anc.imageEffects?.border ? { imageBorder: anc.imageEffects.border } : {}),
        ...(anc.imageEffects?.glow ? { imageGlow: anc.imageEffects.glow } : {}),
        ...(anc.imageEffects?.reflection ? { imageReflection: anc.imageEffects.reflection } : {}),
        ...(anc.imageEffects?.opacity != null ? { imageOpacity: anc.imageEffects.opacity } : {}),
        ...(anc.rotDeg != null ? { rotDeg: anc.rotDeg } : {}),
        ...(anc.flipH != null ? { flipH: anc.flipH } : {}),
        ...(anc.flipV != null ? { flipV: anc.flipV } : {}),
        ...(groupChildren ? { groupChildren } : {}),
        ...(textBoxParas ? { textBoxParas } : {}),
      });
    }
  }
  // الرؤوس/التذييلات: تشكيلٌ حقيقي واختيار first/even/default حسب صفحة المقطع.
  const sectionPageNo = new Map<number, number>();
  const sectionPageTotals = new Map<number, number>();
  for (const pg of pages) sectionPageTotals.set(pg.sectionIndex,
    (sectionPageTotals.get(pg.sectionIndex) ?? 0) + 1);
  let previousLogicalPageNumber = 0;
  for (const pg of pages) {
    const sec = model.sections[pg.sectionIndex] ?? model.section;
    const ordinal = (sectionPageNo.get(pg.sectionIndex) ?? 0) + 1;
    sectionPageNo.set(pg.sectionIndex, ordinal);
    const savedStart = previousLogicalPageNumber === 0 && sec.pgNumStart == null
      ? savedInitialPageNumber(model, sec) : null;
    const logicalPageNumber = ordinal === 1
      ? (sec.pgNumStart ?? savedStart ?? previousLogicalPageNumber + 1)
      : previousLogicalPageNumber + 1;
    previousLogicalPageNumber = logicalPageNumber;
    const refType = sec.titlePg && ordinal === 1 ? "first"
      : model.evenAndOddHeaders && logicalPageNumber % 2 === 0 ? "even" : "default";
    const story = (source: BodyParagraph[]) => materializeMarginFields(source, sec,
      logicalPageNumber, pages.length, sectionPageTotals.get(pg.sectionIndex) ?? 1);
    const showBorder = Boolean(sec.pageBorders)
      && !(sec.pageBorderDisplay === "firstPage" && ordinal !== 1)
      && !(sec.pageBorderDisplay === "notFirstPage" && ordinal === 1);
    if (showBorder) {
      pg.pageBorders = sec.pageBorders!;
      if (sec.pageBorderOffsetFrom) pg.pageBorderOffsetFrom = sec.pageBorderOffsetFrom;
      if (sec.pageBorderZOrder) pg.pageBorderZOrder = sec.pageBorderZOrder;
    }
    const hRef = refType === "first" ? sec.headerRefs?.first
      : refType === "even" ? (sec.headerRefs?.even ?? sec.headerRefs?.default)
      : sec.headerRefs?.default;
    if (hRef && model.headerFooters.has(hRef)) {
      const source = story(model.headerFooters.get(hRef)!);
      pg.headerParas = await buildMarginParas(
        source, sec, ctx, sec.headerDistTwips ?? 720, false,
      );
      await appendMarginAnchors(pg, source, model, sec, ctx, false);
    }
    const fRef = refType === "first" ? sec.footerRefs?.first
      : refType === "even" ? (sec.footerRefs?.even ?? sec.footerRefs?.default)
      : sec.footerRefs?.default;
    if (fRef && model.headerFooters.has(fRef)) {
      const source = story(model.headerFooters.get(fRef)!);
      // بُنيت نسخة أولية عند إنشاء الصفحة كي تدخل مساحة التذييل في التصفيح؛
      // بعد اكتمال عدد الصفحات نعيدها بقيم PAGE/NUMPAGES/SECTIONPAGES الفعلية.
      pg.footerParas = await buildMarginParas(
        source, sec, ctx, pg.heightTwips - (sec.footerDistTwips ?? 720), true,
      );
      await appendMarginAnchors(pg, source, model, sec, ctx, true);
    }
  }
  return { pages, fonts: ctx.fonts };
}

/**
 * بعض ملفات corpus مقتطفات محفوظة من مستند أكبر: لا تحمل pgNumType@start،
 * لكن نتيجة PAGE المحفوظة في قصة الهامش هي رقم البداية المرئي (مثل 26).
 * نستخدمها لأول مقطع فقط؛ المقاطع اللاحقة بلا start تواصل التسلسل السابق.
 */
function savedInitialPageNumber(model: DocumentModelV0, section: SectionGeometry): number | null {
  const firstRef = section.headerRefs?.first ?? section.footerRefs?.first;
  const ordinaryRef = section.headerRefs?.default ?? section.footerRefs?.default
    ?? section.headerRefs?.even ?? section.footerRefs?.even;
  const ref = section.titlePg && firstRef ? firstRef : ordinaryRef;
  if (!ref) return null;
  const paragraphs = model.headerFooters.get(ref);
  if (!paragraphs) return null;
  const scan = (items: BodyParagraph[]): number | null => {
    for (const paragraph of items) {
      for (const run of paragraph.runs) if (run.fieldResult === "PAGE") {
        const normalized = run.text.replace(/[٠-٩]/g, digit =>
          String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).trim();
        if (/^\d+$/.test(normalized)) return Number(normalized);
      }
      for (const anchor of paragraph.anchors) if (anchor.textBox) {
        const nested = scan(anchor.textBox);
        if (nested != null) return nested;
      }
    }
    return null;
  };
  const saved = scan(paragraphs);
  if (saved == null) return null;
  // إن كانت صفحة العنوان بلا قصة first، فالنتيجة المحفوظة في default تخص
  // الصفحة التالية؛ اطرح واحدة لتبقى الصفحة الثانية مساوية للقيمة المحفوظة.
  return section.titlePg && !firstRef ? saved - 1 : saved;
}

/** صياغة أرقام حقول الهامش بلا اعتماد عكسي على طبقة DOM. */
function formatScenePageNumber(section: SectionGeometry, n: number): string {
  const roman = (value: number): string => {
    const pairs: [number, string][] = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],
      [100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
    let left = value, out = "";
    for (const [amount, glyph] of pairs) while (left >= amount) { out += glyph; left -= amount; }
    return out;
  };
  const fmt = section.pgNumFmt ?? "decimal";
  if (fmt === "upperRoman") return roman(n);
  if (fmt === "lowerRoman") return roman(n).toLowerCase();
  if (fmt === "upperLetter" || fmt === "lowerLetter") {
    let value = n, out = "";
    while (value > 0) { value--; out = String.fromCharCode(65 + value % 26) + out;
      value = Math.floor(value / 26); }
    return fmt === "lowerLetter" ? out.toLowerCase() : out;
  }
  if (fmt === "hindiNumbers" || fmt === "hindiCounting")
    return String(n).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]!);
  if (fmt === "thaiNumbers")
    return String(n).replace(/\d/g, digit => "๐๑๒๓๔๕๖๗๘๙"[Number(digit)]!);
  return String(n);
}

/** يحدّث النتائج المرئية للحقول داخل قصة الهامش ومربعات نص مراسيها. */
function materializeMarginFields(
  source: BodyParagraph[], section: SectionGeometry, pageNumber: number,
  totalPages: number, sectionPages: number,
): BodyParagraph[] {
  const values = {
    PAGE: formatScenePageNumber(section, pageNumber),
    NUMPAGES: formatScenePageNumber(section, totalPages),
    SECTIONPAGES: formatScenePageNumber(section, sectionPages),
  } as const;
  const fieldValue = (field: string | null | undefined): string | null => {
    if (field === "PAGE" || field === "NUMPAGES" || field === "SECTIONPAGES")
      return values[field];
    return null;
  };
  const clone = (paragraph: BodyParagraph): BodyParagraph => ({
    ...paragraph,
    runs: paragraph.runs.map(run => {
      const text = fieldValue(run.fieldResult);
      return text == null ? { ...run } : { ...run, text };
    }),
    anchors: paragraph.anchors.map(anchor => ({ ...anchor,
      ...(anchor.textBox ? { textBox: anchor.textBox.map(clone) } : {}),
    })),
  });
  return source.map(clone);
}

function anchorPagePosition(
  anchor: BodyParagraph["anchors"][number], page: ScenePage,
  _section: SectionGeometry, paragraphTop: number,
): { x: number; y: number } {
  const hBase = anchor.posHRel === "page" ? 0 : page.marLeftTwips;
  const vBase = anchor.posVRel === "page" ? 0
    : anchor.posVRel === "paragraph" || anchor.posVRel === "line" ? paragraphTop : page.marTopTwips;
  let x = hBase + (anchor.posHOffset ?? 0);
  let y = vBase + (anchor.posVOffset ?? 0);
  if (anchor.posHAlign) {
    const left = anchor.posHRel === "page" ? 0 : page.marLeftTwips;
    const right = anchor.posHRel === "page" ? page.widthTwips : page.widthTwips - page.marRightTwips;
    if (anchor.posHAlign === "center") x = left + (right - left - anchor.extentW) / 2;
    else if (anchor.posHAlign === "right") x = right - anchor.extentW;
    else x = left;
  }
  if (anchor.posVAlign) {
    const top = anchor.posVRel === "page" ? 0 : page.marTopTwips;
    const bottom = anchor.posVRel === "page" ? page.heightTwips : page.heightTwips - page.marBottomTwips;
    if (anchor.posVAlign === "center") y = top + (bottom - top - anchor.extentH) / 2;
    else if (anchor.posVAlign === "bottom") y = bottom - anchor.extentH;
    else y = top;
  }
  return { x, y };
}

/** يكرر المراسي العائمة التي يملكها جزء الرأس/التذييل على كل صفحة تستعمله. */
async function appendMarginAnchors(
  page: ScenePage, source: BodyParagraph[], model: DocumentModelV0,
  section: SectionGeometry, ctx: BuildContext, footer: boolean,
): Promise<void> {
  for (const paragraph of source) for (const anchor of paragraph.anchors ?? []) {
    if (anchor.inlineFlow) continue;
    const { x, y } = marginAnchorPosition(page, anchor, footer, section);
    const ins = anchor.boxIns ?? { l: 144, t: 72, r: 144, b: 72 };
    const boxSection = { ...section, marLeftTwips: x + ins.l,
      marRightTwips: Math.max(0, section.pageWTwips - x - anchor.extentW + ins.r),
      columnTwips: Math.max(1, anchor.extentW - ins.l - ins.r),
      colWidthTwips: Math.max(1, anchor.extentW - ins.l - ins.r), colCount: 1 };
    const textBoxParas = anchor.textBox?.length
      ? await buildMarginParas(anchor.textBox, boxSection, ctx, y + ins.t, false) : undefined;
    if (textBoxParas?.length && (anchor.boxAnchor === "ctr" || anchor.boxAnchor === "b")) {
      const firstTop = Math.min(...textBoxParas.map(paragraph => paragraph.yTwips));
      const lastBottom = Math.max(...textBoxParas.flatMap(paragraph => paragraph.lines)
        .map(line => line.yTwips - line.ascentTwips + line.heightTwips));
      const free = Math.max(0, anchor.extentH - ins.t - ins.b - (lastBottom - firstTop));
      const shift = anchor.boxAnchor === "ctr" ? free / 2 : free;
      for (const paragraph of textBoxParas) {
        paragraph.yTwips += shift;
        for (const line of paragraph.lines) line.yTwips += shift;
      }
    }
    const groupChildren = sceneGroupChildren(anchor, model, x, y)
      ?? sceneDiagramChildren(anchor, x, y);
    page.anchors.push({ xTwips: x, yTwips: y, wTwips: anchor.extentW, hTwips: anchor.extentH,
      imageData: resolveImage(anchor.rId, model, anchor.part), behindDoc: anchor.behindDoc,
      floating: true, zOrder: anchor.zOrder, shapeFill: groupChildren ? null : anchor.shape?.fill ?? null,
      shapeStroke: groupChildren ? null : anchor.shape?.stroke ?? null,
      shapePrst: groupChildren ? null : anchor.shape?.prst ?? null,
      ...(!groupChildren && anchor.shape?.strokeW != null ? { shapeStrokeWTwips: anchor.shape.strokeW } : {}),
      ...(!groupChildren && anchor.shape?.gradient ? { shapeGradient: anchor.shape.gradient } : {}),
      ...(!groupChildren && anchor.shape?.adj != null ? { shapeAdj: anchor.shape.adj } : {}),
      ...(anchor.chart ? { chart: anchor.chart } : {}),
      ...(anchor.imageEffects?.shadow ? { imageShadow: anchor.imageEffects.shadow } : {}),
      ...(anchor.imageEffects?.border ? { imageBorder: anchor.imageEffects.border } : {}),
      ...(anchor.imageEffects?.glow ? { imageGlow: anchor.imageEffects.glow } : {}),
      ...(anchor.imageEffects?.reflection ? { imageReflection: anchor.imageEffects.reflection } : {}),
      ...(anchor.imageEffects?.opacity != null ? { imageOpacity: anchor.imageEffects.opacity } : {}),
      ...(anchor.rotDeg != null ? { rotDeg: anchor.rotDeg } : {}),
      ...(anchor.flipH != null ? { flipH: anchor.flipH } : {}),
      ...(anchor.flipV != null ? { flipV: anchor.flipV } : {}),
      ...(groupChildren ? { groupChildren } : {}),
      ...(textBoxParas ? { textBoxParas } : {}) });
  }
}

function sceneGroupChildren(
  anchor: BodyParagraph["anchors"][number], model: DocumentModelV0, x: number, y: number,
): NonNullable<import("./types.js").SceneAnchor["groupChildren"]> | undefined {
  if (!anchor.groupChildren?.length) return undefined;
  return anchor.groupChildren.map(child => ({
    xTwips: x + child.x, yTwips: y + child.y, wTwips: child.w, hTwips: child.h,
    imageData: resolveImage(child.rId, model, anchor.part),
    shapeFill: child.shape?.fill ?? null, shapeStroke: child.shape?.stroke ?? null,
    shapePrst: child.shape?.prst ?? null,
    ...(child.shape?.strokeW != null ? { shapeStrokeWTwips: child.shape.strokeW } : {}),
    ...(child.shape?.adj != null ? { shapeAdj: child.shape.adj } : {}),
    ...(child.text ? { text: child.text } : {}),
    ...(child.rotDeg != null ? { rotDeg: child.rotDeg } : {}),
    ...(child.flipH != null ? { flipH: child.flipH } : {}),
    ...(child.flipV != null ? { flipV: child.flipV } : {}),
  }));
}

/** يحول الرسم المحسوب في diagrams/drawingN.xml إلى أطفال مشهد بدل إسقاط SmartArt كله. */
function sceneDiagramChildren(
  anchor: BodyParagraph["anchors"][number], x: number, y: number,
): NonNullable<import("./types.js").SceneAnchor["groupChildren"]> | undefined {
  if (!anchor.diagram?.length) return undefined;
  return anchor.diagram.map(shape => ({
    xTwips: x + shape.x, yTwips: y + shape.y, wTwips: shape.w, hTwips: shape.h,
    imageData: null, shapeFill: shape.fill, shapeStroke: null, shapePrst: shape.prst,
    ...(shape.text ? { text: shape.text } : {}),
    ...(shape.em > 0 ? { textEmTwips: shape.em } : {}),
  }));
}

function marginAnchorPosition(
  page: ScenePage, anchor: BodyParagraph["anchors"][number], footer: boolean,
  section: SectionGeometry,
): { x: number; y: number } {
  let x = anchor.posHOffset ?? 0;
  let y = anchor.posVOffset ?? 0;
  // داخل قصة الرأس/التذييل، VML `...horizontal-relative:text` يُحل في
  // النموذج إلى column.  Word/COM يقيس left عندها من حافة عمود النص، لا من
  // حافة الورقة؛ تجاهل ذلك أزاح خلفيات السيرة يسارًا بمقدار الهامش كاملًا.
  if (anchor.posHRel === "margin" || anchor.posHRel === "column")
    x += page.marLeftTwips;
  if (anchor.posVRel === "margin")
    y += footer ? page.heightTwips - page.marBottomTwips : page.marTopTwips;
  else if (anchor.posVRel === "paragraph" || anchor.posVRel === "line")
    y += footer ? page.heightTwips - (section.footerDistTwips ?? 720)
      : (section.headerDistTwips ?? 720);
  if (anchor.posHAlign && anchor.posHOffset == null) {
    if (anchor.posHAlign === "center") x = (page.widthTwips - anchor.extentW) / 2;
    else if (anchor.posHAlign === "right") x = page.widthTwips - page.marRightTwips - anchor.extentW;
    else x = page.marLeftTwips;
  }
  if (anchor.posVAlign && anchor.posVOffset == null) {
    if (anchor.posVAlign === "center") y = (page.heightTwips - anchor.extentH) / 2;
    else if (anchor.posVAlign === "bottom") y = page.heightTwips - page.marBottomTwips - anchor.extentH;
    else y = page.marTopTwips;
  }
  return { x, y };
}

/**
 * Word lets a foreground header drawing enlarge the effective header area.  A
 * decorative watermark (`behindDoc`) must not push the body, and neither must
 * a page-sized cover/background.  The half-page guard mirrors that distinction
 * without relying on a book name or a visual offset.
 */
export function headerBodyClearance(
  page: ScenePage, source: BodyParagraph[], section: SectionGeometry,
): number {
  let bottom = section.marTopTwips;
  for (const paragraph of source) for (const anchor of paragraph.anchors ?? []) {
    if (anchor.inlineFlow || anchor.behindDoc || anchor.extentH > page.heightTwips / 2) continue;
    const pos = marginAnchorPosition(page, anchor, false, section);
    bottom = Math.max(bottom, pos.y + anchor.extentH);
  }
  return bottom;
}

/**
 * يعيد أدنى موضع يسمح للمتن أن ينتهي عنده بلا الاصطدام بتذييل Word.
 * الهامش السفلي هو الحد الافتراضي. لا تحجز العلامة المائية ولا خلفية بطول
 * الصفحة مساحة، بينما تحجز فقرات التذييل والرسم الأمامي الصغير موضعهما الفعلي.
 */
export function footerBodyClearance(
  page: ScenePage, source: BodyParagraph[], footerParas: SceneParagraph[],
  section: SectionGeometry,
): number {
  let top = page.heightTwips - page.marBottomTwips;
  for (const paragraph of footerParas) for (const line of paragraph.lines)
    top = Math.min(top, line.yTwips - line.ascentTwips);
  for (const paragraph of source) for (const anchor of paragraph.anchors ?? []) {
    if (anchor.inlineFlow || anchor.behindDoc || anchor.extentH > page.heightTwips / 2) continue;
    const pos = marginAnchorPosition(page, anchor, true, section);
    top = Math.min(top, pos.y);
  }
  return Math.max(section.marTopTwips, top);
}

/** ينقل هندسة الصف المبنية دون إعادة التشكيل أو زيادة حالة الترقيم داخل خلاياه. */
function shiftSceneTableRow(row: SceneTableRow, deltaY: number): void {
  row.yTwips += deltaY;
  for (const cell of row.cells) {
    cell.yTwips += deltaY;
    for (const table of cell.nestedTables ?? []) for (const nestedRow of table.rows)
      shiftSceneTableRow(nestedRow, deltaY);
    for (const paragraph of cell.paragraphs) {
      paragraph.yTwips += deltaY;
      for (const line of paragraph.lines) line.yTwips += deltaY;
    }
  }
}

function appendSceneTableRow(page: ScenePage, row: SceneTableRow): void {
  const existing = page.tables!.find(table => table.tableId === row.tableId);
  if (existing) existing.rows.push(row);
  else page.tables!.push({ tableId: row.tableId,
    ...(row.parentTableId != null ? { parentTableId: row.parentTableId,
      parentRow: row.parentRow ?? 0, parentCol: row.parentCol ?? 0,
      parentBlockIndex: row.parentBlockIndex ?? 0 } : {}),
    nestingDepth: row.nestingDepth ?? 0, rows: [row] });
}

function cloneSceneTableRow(row: SceneTableRow): SceneTableRow {
  return { ...row, cells: row.cells.map(cell => ({ ...cell,
    paragraphs: cell.paragraphs.map(paragraph => ({ ...paragraph,
      lines: paragraph.lines.map(line => ({ ...line, words: line.words.slice() })),
    })),
    anchors: cell.anchors.slice(),
    ...(cell.nestedTables ? { nestedTables: cell.nestedTables.map(table => ({ ...table,
      rows: table.rows.map(cloneSceneTableRow),
    })) } : {}),
  })) };
}

/** يضيف نسخة مستقلة من سلسلة رأس الجدول ويعيد موضع أول صف بيانات. */
function appendRepeatedTableHeaders(
  page: ScenePage, headers: readonly SceneTableRow[] | undefined, top: number,
): number {
  let y = top;
  for (const source of headers ?? []) {
    const row = cloneSceneTableRow(source);
    shiftSceneTableRow(row, y - row.yTwips);
    appendSceneTableRow(page, row);
    y += row.hTwips;
  }
  return y;
}

/** يقص صفًا أطول من مساحة الصفحة عند حدود الأسطر، مع إبقاء هندسة الخلايا والحدود. */
function sliceSceneTableRow(row: SceneTableRow, offset: number, capacity: number, top: number): SceneTableRow {
  const height = Math.min(capacity, row.hTwips - offset);
  const cells = row.cells.map(cell => {
    const paragraphs = cell.paragraphs.map(paragraph => {
      const lines = paragraph.lines.filter(line => {
        const lineTop = line.yTwips - line.ascentTwips - row.yTwips;
        return lineTop >= offset && lineTop < offset + height;
      }).map(line => ({ ...line, words: line.words.slice(), yTwips: line.yTwips - row.yTwips - offset + top }));
      return { ...paragraph, lines, yTwips: paragraph.yTwips - row.yTwips - offset + top };
    }).filter(paragraph => paragraph.lines.length > 0);
    return { ...cell, yTwips: top, hTwips: height, paragraphs };
  });
  return { ...row, yTwips: top, hTwips: height, cells };
}

/**
 * Word يشطر صف الجدول عند حد سطر، لا في وسط صندوق الغليف. نرجع من نهاية
 * السعة إلى أعلى سطر يعبرها. إذا كان السطر نفسه أطول من صفحة نسمح بالتقدم
 * بالسعة كي لا تنشأ حلقة صفحات فارغة.
 */
export function tableRowFragmentHeight(
  row: SceneTableRow, offset: number, capacity: number,
): number {
  const end = row.hTwips;
  let boundary = Math.min(end, offset + Math.max(1, capacity));
  if (boundary >= end) return end - offset;
  while (boundary > offset) {
    let crossingTop = Number.POSITIVE_INFINITY;
    for (const cell of row.cells) for (const paragraph of cell.paragraphs)
      for (const line of paragraph.lines) {
        const top = line.yTwips - line.ascentTwips - row.yTwips;
        const bottom = top + line.heightTwips;
        if (top < boundary && bottom > boundary) crossingTop = Math.min(crossingTop, top);
      }
    if (!Number.isFinite(crossingTop)) break;
    if (crossingTop <= offset) return Math.min(capacity, end - offset);
    boundary = crossingTop;
  }
  return Math.max(1, boundary - offset);
}

async function buildMarginParas(
  source: BodyParagraph[], section: SectionGeometry, ctx: BuildContext,
  edgeTwips: number, alignBottom: boolean,
): Promise<SceneParagraph[]> {
  const built: BuiltParagraph[] = [];
  for (const p of source) {
    if (!isRenderableParagraph(p) || p.tableCell || !p.text.trim()) continue;
    const bp = await buildParagraph(p, section, ctx);
    if (bp) built.push(bp);
  }
  const total = built.reduce((n, b) => n + b.lineHeightTwips + b.spacingBeforeTwips + b.spacingAfterTwips, 0);
  let top = alignBottom ? edgeTwips - total : edgeTwips;
  const out: SceneParagraph[] = [];
  for (const b of built) {
    top += b.spacingBeforeTwips;
    const para = { ...b.para, lines: b.para.lines.map((ln) => ({ ...ln })), yTwips: top };
    let baselineTop = top;
    for (const ln of para.lines) {
      ln.yTwips = baselineTop + ln.ascentTwips;
      baselineTop += ln.heightTwips;
    }
    out.push(para);
    top = baselineTop + b.spacingAfterTwips;
  }
  return out;
}

function placeLines(page: ScenePage, para: SceneParagraph, lines: SceneLine[], top: number): void {
  const seg: SceneParagraph = { ...para, lines, yTwips: top };
  let y = top;
  for (const ln of lines) {
    ln.yTwips = y + ln.ascentTwips; // خط الأساس
    y += ln.heightTwips;
  }
  page.paragraphs.push(seg);
}

function sumHeights(lines: SceneLine[]): number {
  let h = 0;
  for (const ln of lines) h += ln.heightTwips;
  return h;
}

/** قرار bounded: انقل الحالية فقط إن كانت الحزمة المطلوبة تتسع في صفحة فارغة. */
export function keptParagraphNeedsFreshPage(
  remaining: number, freshCapacity: number, paragraphHeight: number, nextFirstWithGap: number,
  keepLines: boolean, keepNext: boolean,
): boolean {
  const required = paragraphHeight + (keepNext ? nextFirstWithGap : 0);
  if (required > freshCapacity) return false;
  return (keepLines || (keepNext && nextFirstWithGap > 0)) && required > remaining;
}

/** حد Word للسطرين، مع السماح بالتقدم على صفحة فارغة ضيقة لمنع الحلقة. */
export function widowOrphanLineFit(
  fit: number, totalRemaining: number, atFreshPageTop: boolean, enabled = true,
): number {
  if (!enabled || totalRemaining < 2) return fit;
  if (!atFreshPageTop && fit === 1) return 0;
  if (fit > 1 && totalRemaining - fit === 1) return fit - 1;
  return fit;
}

/** يبني مرة واحدة فهرس الفقرة المتنية المؤهلة التالية لكل موضع.
 * يمنع slice/find التربيعي في الكتب ذات مئات keepNext وآلاف الفقرات. */
export function nextRenderableParagraphIndexes(paragraphs: BodyParagraph[]): Int32Array {
  const out = new Int32Array(paragraphs.length);
  out.fill(-1);
  let next = -1;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    out[i] = next;
    const p = paragraphs[i]!;
    if (isRenderableParagraph(p) && !p.tableCell && p.text.trim()) next = i;
  }
  return out;
}

/** يجمع فقرات الخلايا إلى ملكية table→row→cell مع بقاء spans/borders/anchors في ctx. */
export function groupSceneTableSources(paragraphs: BodyParagraph[]): SceneTableSource[] {
  const tables = new Map<number, Map<number, Map<number, BodyParagraph[]>>>();
  for (const paragraph of paragraphs) {
    const cell = paragraph.tableCell;
    if (!cell) continue;
    let rows = tables.get(cell.tableId);
    if (!rows) { rows = new Map(); tables.set(cell.tableId, rows); }
    let cells = rows.get(cell.row);
    if (!cells) { cells = new Map(); rows.set(cell.row, cells); }
    const owned = cells.get(cell.col) ?? [];
    owned.push(paragraph); cells.set(cell.col, owned);
  }
  return [...tables].sort(([a], [b]) => a - b).map(([tableId, rows]) => ({
    tableId,
    ...(() => {
      const first = [...rows.values()].flatMap(cells => [...cells.values()]).flat()[0]?.tableCell;
      return first ? {
        ...(first.parentTableId != null ? { parentTableId: first.parentTableId,
          parentRow: first.parentRow ?? 0, parentCol: first.parentCol ?? 0,
          parentBlockIndex: first.parentBlockIndex ?? 0 } : {}),
        nestingDepth: first.nestingDepth ?? 0,
      } : {};
    })(),
    rows: [...rows].sort(([a], [b]) => a - b).map(([row, cells]) => {
      const ordered = [...cells].sort(([a], [b]) => a - b);
      return {
        tableId, row,
        ...(() => {
          const first = ordered[0]?.[1][0]?.tableCell;
          return first ? {
            ...(first.parentTableId != null ? { parentTableId: first.parentTableId,
              parentRow: first.parentRow ?? 0, parentCol: first.parentCol ?? 0,
              parentBlockIndex: first.parentBlockIndex ?? 0 } : {}),
            nestingDepth: first.nestingDepth ?? 0,
          } : {};
        })(),
        cantSplit: ordered.some(([, ps]) => ps[0]?.tableCell?.cantSplit),
        repeatHeader: ordered.some(([, ps]) => ps[0]?.tableCell?.repeatHeader),
        cells: ordered.map(([, ps]) => ({ tableCell: ps[0]!.tableCell!, paragraphs: ps })),
      };
    }),
  }));
}

export type TableRowPageDecision = "place" | "move" | "split";
/** max cell height هو ارتفاع الصف؛ الصف الأطول من الصفحة ينشق حتى مع cantSplit. */
export function tableRowPageDecision(
  maxCellHeight: number, remaining: number, freshCapacity: number, cantSplit: boolean,
): TableRowPageDecision {
  if (maxCellHeight <= remaining) return "place";
  if (cantSplit && maxCellHeight <= freshCapacity) return "move";
  return "split";
}

// ---------- بناء فقرة: كلمات ⟵ أسطر ⟵ قياسات
interface BuiltParagraph {
  para: SceneParagraph;
  spacingBeforeTwips: number;
  spacingAfterTwips: number;
  lineHeightTwips: number;
}

/** يحسم ارتفاع سطر المشهد من w:spacing بعد قياس الغليفات.
 * auto دون 240 لا يجوز أن يصغر عن صندوق الغليفات؛ exact وحده يملك دلالة القص
 * الصريحة، وatLeast حد أدنى. */
export function resolvedSceneLineHeight(
  natural: number,
  spacing: BodyParagraph["spacing"],
): number {
  const line = spacing.line;
  if (line == null || line <= 0) return natural;
  if (spacing.lineRule === "exact") return line;
  if (spacing.lineRule === "atLeast") return Math.max(natural, line);
  return Math.max(natural, natural * line / 240);
}

/** موضع الحافة اليسرى للجدول بحسب محاذاة Word الفيزيائية واتجاهه البصري. */
export function sceneTableStart(
  section: SectionGeometry,
  table: Pick<NonNullable<BodyParagraph["tableCell"]>,
    "totalGridTwips" | "tblIndTwips" | "tblJc" | "bidiVisual">,
): number {
  const left = section.marLeftTwips;
  const right = section.pageWTwips - section.marRightTwips - table.totalGridTwips;
  switch (table.tblJc) {
    case "center": return left + (section.columnTwips - table.totalGridTwips) / 2;
    case "right": return right;
    case "left": return left;
    case "start": return table.bidiVisual ? right : left;
    case "end": return table.bidiVisual ? left : right;
    default: return left + table.tblIndTwips;
  }
}

async function buildSceneTableRow(
  source: SceneTableSource["rows"][number], section: SectionGeometry, ctx: BuildContext, top: number,
  tableSources?: ReadonlyMap<number, SceneTableSource>,
): Promise<SceneTableRow> {
  const first = source.cells[0]?.tableCell;
  const tableX = first ? sceneTableStart(section, first) : section.marLeftTwips;
  const cells: SceneTableRow["cells"] = [];
  let rowHeight = 0;
  for (const cellSource of source.cells) {
    const cell = cellSource.tableCell;
    const x = tableX + cell.colXTwips;
    const contentX = x + cell.marLeft;
    const contentW = Math.max(1, cell.colWTwips - cell.marLeft - cell.marRight);
    const cellSection: SectionGeometry = { ...section,
      marLeftTwips: contentX, marRightTwips: Math.max(0, section.pageWTwips - contentX - contentW),
      columnTwips: contentW, colWidthTwips: contentW, colCount: 1 };
    const paragraphs: SceneParagraph[] = [];
    let cellY = top + cell.marTop;
    let previousAfter = 0;
    const nestedTables: SceneTableFragment[] = [];
    const children = tableSources ? [...tableSources.values()].filter(table =>
      table.parentTableId === cell.tableId && table.parentRow === cell.row && table.parentCol === cell.col) : [];
    const blocks = [
      ...children.map(child => ({ index: child.parentBlockIndex ?? 0, order: child.tableId,
        kind: "table" as const, child })),
      ...cellSource.paragraphs.map(paragraph => ({ index: paragraph.tableCell?.cellBlockIndex ?? Number.MAX_SAFE_INTEGER,
        order: paragraph.index, kind: "paragraph" as const, paragraph })),
    ].sort((a, b) => a.index - b.index || a.order - b.order);
    for (const block of blocks) {
      if (block.kind === "table") {
        cellY += previousAfter; previousAfter = 0;
        const child = block.child;
        const rows: SceneTableRow[] = [];
        for (const childRow of child.rows) {
          const built = await buildSceneTableRow(childRow, cellSection, ctx, cellY, tableSources);
          rows.push(built);
          cellY += built.hTwips;
        }
        nestedTables.push({ tableId: child.tableId,
          ...(child.parentTableId != null ? { parentTableId: child.parentTableId,
            parentRow: child.parentRow ?? 0, parentCol: child.parentCol ?? 0,
            parentBlockIndex: child.parentBlockIndex ?? 0 } : {}),
          nestingDepth: child.nestingDepth ?? 0, rows });
        continue;
      }
      const paragraph = block.paragraph;
      if (!isRenderableParagraph(paragraph)) continue;
      const built = await buildParagraph(paragraph, cellSection, ctx);
      if (!built) continue;
      const gap = paragraphs.length ? Math.max(previousAfter, built.spacingBeforeTwips) : built.spacingBeforeTwips;
      cellY += gap;
      const lines = built.para.lines.map(line => ({ ...line, words: line.words.slice() }));
      const positioned: SceneParagraph = { ...built.para, lines, yTwips: cellY };
      let lineTop = cellY;
      for (const line of lines) { line.yTwips = lineTop + line.ascentTwips; lineTop += line.heightTwips; }
      paragraphs.push(positioned);
      cellY = lineTop; previousAfter = built.spacingAfterTwips;
    }
    let height = cellY + previousAfter + cell.marBottom - top;
    if (cell.rowHeightRule === "exact" && cell.rowHeight != null) height = cell.rowHeight;
    else if (cell.rowHeightRule === "atLeast" && cell.rowHeight != null) height = Math.max(height, cell.rowHeight);
    rowHeight = Math.max(rowHeight, height);
    cells.push({ xTwips: x, yTwips: top, wTwips: cell.colWTwips, hTwips: height,
      gridSpan: cell.gridSpan, shdFill: cell.shdFill, borders: cell.tcBorders,
      ...(nestedTables.length ? { nestedTables } : {}),
      paragraphs, anchors: cellSource.paragraphs.flatMap(paragraph => paragraph.anchors ?? []) });
  }
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const align = source.cells[i]?.tableCell.vAlign;
    const free = Math.max(0, rowHeight - cell.hTwips);
    const delta = align === "bottom" ? free : align === "center" ? free / 2 : 0;
    if (delta > 0) for (const paragraph of cell.paragraphs) {
      paragraph.yTwips += delta;
      for (const line of paragraph.lines) line.yTwips += delta;
    }
    if (delta > 0) for (const table of cell.nestedTables ?? [])
      for (const nestedRow of table.rows) shiftSceneTableRow(nestedRow, delta);
    cell.hTwips = rowHeight;
  }
  return { tableId: source.tableId, row: source.row, yTwips: top,
    ...(source.parentTableId != null ? { parentTableId: source.parentTableId,
      parentRow: source.parentRow ?? 0, parentCol: source.parentCol ?? 0,
      parentBlockIndex: source.parentBlockIndex ?? 0 } : {}),
    nestingDepth: source.nestingDepth ?? 0,
    hTwips: rowHeight, cantSplit: source.cantSplit, repeatHeader: source.repeatHeader, cells };
}

/** تعليمات الحقل بنيوية، أما run النتيجة المرئي فلا يجوز إسقاط فقرته كلها. */
function isRenderableParagraph(paragraph: BodyParagraph): boolean {
  return paragraph.excluded === false
    || (paragraph.excluded === "field" && paragraph.text.trim().length > 0);
}

async function buildParagraph(
  p: BodyParagraph, section: SectionGeometry, ctx: BuildContext,
): Promise<BuiltParagraph | null> {
  await ctx.cooperate();
  const columnTwips = section.colWidthTwips || (section.pageWTwips - section.marLeftTwips - section.marRightTwips);
  const widthTwips = columnTwips - p.indLeft - p.indRight;
  if (widthTwips <= 0) return null;
  const dir: Direction = p.bidi ? "rtl" : firstStrongDirection(p.text);
  const levels = computeLevels(p.text, dir);

  // 1) كلمات مُشكّلة من الرنّات + قياس
  // ملاحظة: p.text = تسلسل نصوص الرنّات **غير المخفية** — فoffset يُقدَّم
  // بنصوص الرنّات المرئية فقط (الخفية تُقصى بلا أثر في مستوى BiDi).
  const words: SceneWord[] = [];
  let offset = 0;
  let pendingTab = false;
  let naturalFlowTwips = 0;
  for (const run of p.runs) {
    await ctx.cooperate();
    if (run.hidden || !run.text) continue;
    const family = run.family ?? null;
    const fi = await resolveFont(ctx, family, run.bold, run.italic);
    if (fi < 0) { offset += run.text.length; continue; } // لا خط — لا ترسيم
    const sourceEmTwips = run.emTwips ?? ctx.defaultEmTwips;
    const verticalScript = run.superscript || run.subscript;
    const emTwips = verticalScript ? sourceEmTwips * 0.58 : sourceEmTwips;
    const look = runLook(run);
    const split = splitWords(run.text);
    if (split.breakBeforeFirst && words.length > 0)
      words[words.length - 1]!.forcedBreakAfter = true;
    const tokens = split.tokens;
    if (split.tabBeforeFirst) pendingTab = true;
    const spaceAdv = spaceAdvance(ctx, fi);
    for (const tok of tokens) {
      if (!tok.text) continue;
      const level = levels[offset + tok.start] ?? 0;
      // اتجاه تشكيل الكلمة = اتجاه خطّها (نص عربي ⇒ rtl) لا تكافؤ مستوى BiDi:
      // AL تُحل عند أساس RTL إلى مستوى 2 (زوجي) لكن حروفها تُرسم RTL.
      const dir = scriptDirection(tok.text);
      const horizontalScale = run.charScale != null && run.charScale > 0
        ? run.charScale / 100 : 1;
      const w = shapeWord(tok.text, fi, dir, emTwips, level, ctx, look,
        wordKerningFeatures(emTwips, run.kern), horizontalScale, run.charSpacing ?? 0);
      // Word يصغّر super/sub إلى نحو 58% ويرفع/يخفض الأساس بنسبة من الحجم
      // الأصلي. w:position مستقل ولا يصغّر الخط؛ الموجب رفع والسالب خفض.
      w.baselineShiftTwips = (run.position ?? 0)
        + (run.superscript ? sourceEmTwips * 0.4 : run.subscript ? -sourceEmTwips * 0.4 : 0);
      const tabBefore = pendingTab || tok.tabBefore;
      const normalSpace = tok.spaceBefore
        ? spaceAdv * w.unitTwips * horizontalScale + (run.charSpacing ?? 0) : 0;
      if (tabBefore) {
        const stops = p.tabStops.filter(stop => stop.val !== "clear" && stop.val !== "bar")
          .map(stop => stop.posTwips).filter(pos => pos > naturalFlowTwips).sort((a, b) => a - b);
        const target = stops[0] ?? (Math.floor(naturalFlowTwips / ctx.defaultTabStopTwips) + 1)
          * ctx.defaultTabStopTwips;
        w.spaceBeforeTwips = Math.max(0, target - naturalFlowTwips);
      } else w.spaceBeforeTwips = normalSpace;
      w.forcedBreakAfter = tok.forcedBreakAfter;
      words.push(w);
      naturalFlowTwips += w.spaceBeforeTwips + w.advanceTwips;
      if (w.forcedBreakAfter) naturalFlowTwips = 0;
      pendingTab = false;
    }
    if (split.trailingTab) pendingTab = true;
    offset += run.text.length;
  }
  if (words.length === 0) return null;

  // 2) كسر الأسطر
  const items: BreakItem[] = words.map((w, i) => ({
    width: w.advanceTwips,
    spaceBefore: i === 0 ? 0 : w.spaceBeforeTwips,
    blankBefore: i > 0,
    trailingOverhang: trailingOverhangOf(w),
    ...(w.forcedBreakAfter ? { forcedBreakAfter: true } : {}),
  }));
  const lines = breakLines(items, {
    columnTwips: widthTwips,
    firstLineIndentTwips: p.indFirstLine,
    justified: p.jc === "both",
    compatibilityMode: ctx.compatibilityMode,
  });

  // 3) أسطر مشهد
  const sceneLines: SceneLine[] = [];
  for (const ln of lines) {
    const lineWords = words.slice(ln.start, ln.end);
    // L2 البصري ثم عكسه لأساس RTL ليصير ترتيبَ تدفّقٍ من حافة البداية
    const visual = visualRunOrder(lineWords.map((w) => w.level));
    const flowIdx = dir === "rtl" ? [...visual].reverse() : visual;
    const ordered = flowIdx.map((i) => lineWords[i]!);
    const natural = sumWordWidth(ordered);
    const avail = widthTwips - (sceneLines.length === 0 ? p.indFirstLine : 0);
    let shrinkFactor: number | null = null;
    if (ln.shrunk) {
      shrinkFactor = natural > 0 ? avail / natural : 1;
    }
    const justified = p.jc === "both" && lines.length > 1 && !ln.forced && !ln.shrunk;
    if (justified) distributeJustify(ordered, natural, avail);
    const width = sumWordWidth(ordered);
    const asc = Math.max(maxOf(ordered, (w) => w.ascentTwips + Math.max(0, w.baselineShiftTwips)),
      ctx.defaultEmTwips * 0.7);
    const desc = Math.max(maxOf(ordered, (w) => w.descentTwips + Math.max(0, -w.baselineShiftTwips)),
      ctx.defaultEmTwips * 0.25);
    const gap = maxOf(ordered, (w) => w.gapTwips);
    const offsetTwips = alignOffset(p.jc, width, avail, dir);
    const start = lineStart(p, section, dir, offsetTwips, sceneLines.length === 0);
    const naturalHeight = asc + desc + gap;
    sceneLines.push({
      words: ordered, startTwips: start, widthTwips: width,
      ascentTwips: asc, descentTwips: desc, lineGapTwips: gap,
      heightTwips: resolvedSceneLineHeight(naturalHeight, p.spacing),
      yTwips: 0, justified, shrinkFactor,
    });
  }

  // توليد علامة الترقيم
  let markerText: string | null = null
  let markerWidthTwips = 0
  if (p.numbered) {
    const levelKey = `${p.numId ?? "__null"}/${p.ilvl ?? "0"}`;
    const level = ctx.numbering.get(levelKey);
    const currentLevel = Number(p.ilvl ?? 0);
    // تقدمُ مستوى أعلى يعيد المستويات التابعة إلى بداياتها في Word.
    for (const key of [...ctx.numberingState.keys()]) {
      const [num, rawLevel] = key.split("/");
      if (num === (p.numId ?? "__null") && Number(rawLevel) > currentLevel)
        ctx.numberingState.delete(key);
    }
    const seq = (ctx.numberingState.get(levelKey) ?? ((level?.start ?? 1) - 1)) + 1;
    ctx.numberingState.set(levelKey, seq);
    const formatted = formatScenePageNumber({ ...section, pgNumFmt: level?.fmt ?? "decimal" }, seq);
    markerText = level?.fmt === "none" ? ""
      : level?.lvlText ? level.lvlText.replace(/%([1-9])/g, (_match, raw: string) => {
          const referencedLevel = Number(raw) - 1;
          const referenced = ctx.numbering.get(`${p.numId ?? "__null"}/${referencedLevel}`);
          const value = referencedLevel === currentLevel ? seq
            : (ctx.numberingState.get(`${p.numId ?? "__null"}/${referencedLevel}`)
              ?? referenced?.start ?? 1);
          return formatScenePageNumber({ ...section, pgNumFmt: referenced?.fmt ?? "decimal" }, value);
        })
      : `${formatted}.`;
    markerWidthTwips = 360 // عرض تقريبي لـ "99." (ضبط لاحق)
  }

  const para: SceneParagraph = {
    index: p.index,
    dir,
    jc: p.jc,
    flowStartTwips: flowStart(p, section, dir),
    widthTwips,
    firstLineIndentTwips: p.indFirstLine,
    spacingBeforeTwips: p.spacing.before ?? 0,
    spacingAfterTwips: p.spacing.after ?? 0,
    shd: p.shd ?? null,
    pBdr: p.pBdr as SceneParagraph["pBdr"] ?? null,
    numbered: p.numbered,
    markerText,
    markerWidthTwips,
    lines: sceneLines,
    yTwips: 0,
  };
  return {
    para,
    spacingBeforeTwips: p.spacing.before ?? 0,
    spacingAfterTwips: p.spacing.after ?? 0,
    lineHeightTwips: sumHeights(sceneLines),
  };
}

function sumWordWidth(words: SceneWord[]): number {
  let w = 0;
  for (const x of words) w += x.advanceTwips + x.spaceBeforeTwips;
  return w;
}

function firstStrongDirection(text: string): Direction {
  for (let i = 0; i < text.length; i++) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    if (/[\u0590-\u08FF\uFB50-\uFEFC]/.test(ch)) return "rtl";
    if (/[A-Za-z]/.test(ch)) return "ltr";
  }
  return "rtl";
}

/** اتجاه خطّ الكلمة لـ HarfBuzz/الرسم: أي حرفٍ RTL (عربي/عبري) يجعلها rtl. */
function scriptDirection(text: string): Direction {
  for (let i = 0; i < text.length; i++) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    if (/[\u0590-\u08FF\uFB50-\uFEFC]/.test(ch)) return "rtl";
    if (/[A-Za-z0-9]/.test(ch)) return "ltr";
  }
  return "ltr";
}

function runLook(run: {
  bold?: boolean; italic?: boolean; underline?: string | null;
  underlineColor?: string | null; color?: string | null; highlight?: string | null;
  strike?: boolean;
}): SceneLook {
  return {
    color: run.color ?? null,
    bold: run.bold === true,
    italic: run.italic === true,
    underline: run.underline != null && run.underline !== "none",
    underlineColor: run.underlineColor ?? null,
    highlight: run.highlight ? highlightHex(run.highlight) : null,
    strike: run.strike === true,
  };
}

interface Token {
  text: string;
  start: number;
  spaceBefore: boolean;
  forcedBreakAfter: boolean;
  tabBefore: boolean;
}
/**
 * يقسم run عند U+0020، ويحفظ فاصل w:br الذي مثّله النموذج بـLF بوصفه
 * حدّ سطر إجباريًا لا جزءًا من غليف الكلمة. NBSP يبقى داخل الكلمة كما في Word.
 * وقد يأتي w:br في run مستقل، لذلك نعيد breakBeforeFirst ليرتبط بآخر كلمة
 * مرئية من run السابق.
 */
function splitWords(text: string): { tokens: Token[]; breakBeforeFirst: boolean;
  tabBeforeFirst: boolean; trailingTab: boolean } {
  const tokens: Token[] = [];
  let start = 0;
  let pendingSpace = false;
  let breakBeforeFirst = false;
  let tabBeforeFirst = false;
  let pendingTab = false;
  const emit = (end: number) => {
    if (end <= start) return;
    tokens.push({ text: text.slice(start, end), start, spaceBefore: pendingSpace,
      forcedBreakAfter: false, tabBefore: pendingTab });
    pendingSpace = false;
    pendingTab = false;
  };
  for (let i = 0; i <= text.length; i++) {
    const ch = i < text.length ? text[i] : undefined;
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r" && ch !== undefined) continue;
    emit(i);
    if (ch === " ") pendingSpace = true;
    else if (ch === "\t") {
      if (tokens.length === 0) tabBeforeFirst = true;
      pendingTab = true;
      pendingSpace = false;
    }
    else if (ch === "\n") {
      if (tokens.length > 0) tokens[tokens.length - 1]!.forcedBreakAfter = true;
      else breakBeforeFirst = true;
      pendingSpace = false;
    }
    start = i + 1;
  }
  return { tokens, breakBeforeFirst, tabBeforeFirst, trailingTab: pendingTab };
}

async function resolveFont(ctx: BuildContext, family: string | null, bold?: boolean, italic?: boolean): Promise<number> {
  const req = fontRequest(family, bold, italic);
  const key = `${req.family}|${!!bold}|${!!italic}`;
  const hit = ctx.fontIndex.get(key);
  if (hit !== undefined) return hit;
  const resolved = ctx.provider.resolveFontDetailed
    ? await ctx.provider.resolveFontDetailed(req) : null;
  const data = resolved?.data ?? await ctx.provider.resolveFont(req);
  if (!data) return -1;
  const m = ctx.shaper.hMetrics(data);
  const font: SceneFont = { key, family: req.family, data, upem: m.upem, ascender: m.ascender, descender: m.descender, lineGap: m.lineGap };
  if (resolved) {
    font.resolvedFamily = resolved.resolvedFamily;
    font.resolutionSource = resolved.source;
    font.substituted = resolved.source !== "exact";
  }
  if (bold) font.bold = true;
  if (italic) font.italic = true;
  ctx.fonts.push(font);
  const idx = ctx.fonts.length - 1;
  ctx.fontIndex.set(key, idx);
  return idx;
}

function spaceAdvance(ctx: BuildContext, fi: number): number {
  const cached = ctx.spaceAdv.get(fi);
  if (cached !== undefined) return cached;
  const font = ctx.fonts[fi]!;
  const run = ctx.shaper.shape({ text: " ", fontData: font.data, direction: "rtl", scale: font.upem });
  const adv = run.totalAdvance;
  ctx.spaceAdv.set(fi, adv);
  return adv;
}

function shapeWord(
  text: string, fi: number, direction: Direction, emTwips: number, level: number,
  ctx: BuildContext, look: SceneLook, features?: readonly string[], horizontalScale = 1,
  charSpacingTwips = 0,
): SceneWord {
  const font = ctx.fonts[fi]!;
  const request = { text, fontData: font.data, direction, scale: font.upem,
    ...(features?.length ? { features } : {}) };
  const run = ctx.shaper.shape(request);
  const unit = emTwips / font.upem;
  const glyphs: SceneGlyph[] = run.glyphs.map((g) => ({ ...g }));
  if (charSpacingTwips !== 0 && glyphs.length > 1) {
    const delta = charSpacingTwips / (unit * horizontalScale);
    for (let index = 0; index < glyphs.length - 1; index++) {
      if (glyphs[index]!.cluster !== glyphs[index + 1]!.cluster)
        glyphs[index]!.xAdvance += delta;
    }
  }
  let adv = 0;
  for (const g of glyphs) adv += g.xAdvance;
  return {
    ...look,
    text, fontIndex: fi, direction, glyphs, advanceTwips: adv * unit * horizontalScale,
    spaceBeforeTwips: 0, baselineShiftTwips: 0, level,
    emTwips, unitTwips: unit, horizontalScale, ascentTwips: font.ascender * unit,
    descentTwips: -font.descender * unit, upem: font.upem, gapTwips: font.lineGap * unit,
  };
}

/** w:kern حد بالحجم (أنصاف نقاط) لا مقدار تباعد. تحت الحد يعطل Word kerning. */
export function wordKerningFeatures(
  emTwips: number, kernHalfPoints: number | undefined,
): readonly string[] | undefined {
  if (kernHalfPoints == null || kernHalfPoints <= 0) return undefined;
  return emTwips >= kernHalfPoints * 10 ? undefined : ["-kern"];
}

/** توزيع فائض التسويغ/الانكماش على مسافات السطر (بـ twips كسرية). */
function distributeJustify(words: SceneWord[], natural: number, avail: number): void {
  const deficit = avail - natural;
  const spaces = words.length - 1;
  if (spaces <= 0) return;
  const per = deficit / spaces;
  for (let i = 1; i < words.length; i++) words[i]!.spaceBeforeTwips += per;
}

/** إزاحة محاذاة السطر داخل عرضه المتاح (0 = بداية). */
function alignOffset(jc: string | null, width: number, avail: number, dir: Direction): number {
  const free = Math.max(0, avail - width);
  if (jc === "center") return free / 2;
  // left/right are physical Word edges, while start/end follow the paragraph
  // direction.  Collapsing `end` into the default start edge is especially
  // visible in RTL stories: a logically left-aligned caption jumps back to
  // the right margin in the scene/canvas renderer even though the DOM path is
  // correct.
  const atFlowEnd = jc === "end"
    || (jc === "left" && dir === "rtl")
    || (jc === "right" && dir === "ltr");
  return atFlowEnd ? free : 0;
}

function flowStart(p: BodyParagraph, section: SectionGeometry, dir: Direction): number {
  if (dir === "rtl") return section.pageWTwips - section.marRightTwips - p.indRight;
  return section.marLeftTwips + p.indLeft;
}

function lineStart(
  p: BodyParagraph, section: SectionGeometry, dir: Direction, offset: number, firstLine: boolean,
): number {
  const base = flowStart(p, section, dir);
  const indent = firstLine ? p.indFirstLine : 0;
  const shift = indent + offset;
  return dir === "rtl" ? base - shift : base + shift;
}

/** تدلّي الترقيم الطرفيّ (القاعدة 16-ب): آخر محرفٍ ترقيم قد يتجاوز الهامش
 *  دون كسر — نقدّر عرض المحرف الواحد محصورًا بـ 12tw. */
function trailingOverhangOf(w: SceneWord): number {
  if (w.text.length === 0) return 0;
  const last = w.text[w.text.length - 1]!;
  if (!/[،؛,:!؟»)]/.test(last)) return 0;
  const single = w.glyphs.length > 0 ? w.glyphs[w.glyphs.length - 1]! : null;
  if (!single) return 0;
  return Math.min(single.xAdvance * w.unitTwips, 12);
}

function maxOf<T>(arr: T[], f: (t: T) => number): number {
  let m = 0;
  for (const x of arr) m = Math.max(m, f(x));
  return m;
}

/** حلّ بايتات الصورة من rId عبر relTargets و mediaFiles */
function resolveImage(rId: string | null, model: DocumentModelV0, part = "document.xml"): Uint8Array | null {
  if (!rId) return null;
  const target = model.partRels.get(part)?.get(rId) ?? model.relTargets.get(rId)
    ?? model.partRels.get("document.xml")?.get(rId);
  if (!target) return null;
  const fileName = target.replace(/^media\//, '');
  return model.mediaFiles.get(fileName) ?? model.mediaFiles.get(target) ?? null;
}
