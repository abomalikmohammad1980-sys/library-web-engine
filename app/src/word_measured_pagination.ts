export interface MeasuredTableRow {
  bottom: number
  paragraphIndices: readonly number[]
}

export interface MeasuredParagraphKeep {
  index: number
  keepNext?: boolean
  pageBreakBefore?: boolean
}

/** يبقي إصلاح overflow داخل فتحات خريطة Word السلطوية ولا ينشئ صفحة أخيرة زائدة. */
export function redistributeMeasuredOverflowWithinWordPages<T>(
  group: readonly T[], following: readonly (readonly T[])[], splitAt: number,
): { page: T[]; following: T[][] } {
  const rest = following.map(page => [...page])
  if (splitAt <= 0 || splitAt >= group.length || !rest.length) return { page: [...group], following: rest }
  rest[0] = [...group.slice(splitAt), ...rest[0]!]
  return { page: group.slice(0, splitAt), following: rest }
}

/**
 * خريطة Word قد تضع حد Range البنيوي بين عنوان keepNext وأول متن له. نعالج
 * هذا الحد كمرساة أولية لا كإذن بترك العنوان وحيدًا: تُنقل سلسلة keepNext
 * الأخيرة إلى أول الصفحة التالية، مع إبقاء عدد الصفحات وترتيب الفقرات.
 */
export function repairMappedKeepNextBoundaries<T extends MeasuredParagraphKeep>(
  groups: readonly (readonly T[])[],
): T[][] {
  const repaired = groups.map(group => [...group])
  for (let page = 0; page + 1 < repaired.length; page++) {
    const current = repaired[page]!, next = repaired[page + 1]!
    let start = current.length
    while (start > 0 && current[start - 1]?.keepNext && !next[0]?.pageBreakBefore) start--
    if (start < current.length) next.unshift(...current.splice(start))
  }
  return repaired
}

/**
 * Word treats a consecutive keepNext chain as one pagination unit.  Browser
 * measurement first tells us which paragraph overflowed; walk backwards over
 * authored keepNext links so a heading is not left at the foot of the previous
 * page.  An explicit page boundary is authoritative and is never crossed.
 */
export function keepNextAwareSplitIndex(
  paragraphs: readonly MeasuredParagraphKeep[],
  proposedSplit: number,
): number {
  if (proposedSplit <= 0 || proposedSplit >= paragraphs.length) return proposedSplit
  let split = proposedSplit
  while (split > 0) {
    const incoming = paragraphs[split]
    const previous = paragraphs[split - 1]
    if (incoming?.pageBreakBefore || !previous?.keepNext) break
    split--
  }
  // A keepNext chain taller than a whole page cannot be moved indefinitely.
  // Preserve forward progress and let the measured overflow split its body.
  return split > 0 ? split : proposedSplit
}

/**
 * Word reserves the footnote story inside the printable page area.  The DOM
 * probe renders that story after the main blocks, so its measured height must
 * be removed from the main-flow limit before deciding where the page splits.
 */
export function effectiveMeasuredContentLimit(
  printableBottom: number,
  footnoteHeight: number,
  footerTop?: number,
  pageNumberTop?: number,
  safetyGap = 8,
): number {
  const obstacles = [footerTop, pageNumberTop]
    .filter((value): value is number => value !== undefined && Number.isFinite(value))
  const obstacleTop = obstacles.length ? Math.min(...obstacles) : Number.POSITIVE_INFINITY
  // لا ننقص هامش الأمان من حد Word العادي؛ نحتاجه فقط عندما يكون التذييل
  // أو رقم الصفحة أعلى منه فعلًا. وبذلك لا تتغير الصفحات الخالية من تذييل.
  const storyBottom = obstacleTop < printableBottom
    ? Math.max(0, obstacleTop - Math.max(0, Number.isFinite(safetyGap) ? safetyGap : 0))
    : printableBottom
  return storyBottom - Math.max(0, Number.isFinite(footnoteHeight) ? footnoteHeight : 0)
}

/** يختار أول فقرة في أول صف جدول متجاوز؛ لا يشطر الخلية ولا البيت الشعري. */
export function measuredOverflowSplitIndex(
  groupParagraphIndices: readonly number[],
  blockParagraphIndices: readonly number[],
  limit: number,
  tableRows: readonly MeasuredTableRow[] = [],
): number {
  for (const row of tableRows) {
    if (row.bottom <= limit) continue
    const positions = row.paragraphIndices.map(index => groupParagraphIndices.indexOf(index)).filter(index => index >= 0)
    if (positions.length) return Math.min(...positions)
    break
  }
  const positions = blockParagraphIndices.map(index => groupParagraphIndices.indexOf(index)).filter(index => index >= 0)
  return positions.length ? Math.min(...positions) : -1
}
