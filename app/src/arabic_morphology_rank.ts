export interface MorphologicalAnalysisLike { lemma: string; stem: string; root: string }

/**
 * يقدّم تحليلات الجذر الأكثر تكرارًا، ثم يحافظ داخل المجموعة على ترتيب
 * الخليل الأصلي المبني على تواتر المدونة.
 */
export function rankMorphologicalAnalyses<T extends MorphologicalAnalysisLike>(rows: T[]): T[] {
  const counts = new Map<string, number>()
  for (const row of rows) if (row.root && row.root !== '-' && row.root !== '#') counts.set(row.root, (counts.get(row.root) ?? 0) + 1)
  const dominant = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  return dominant ? [...rows.filter(row => row.root === dominant), ...rows.filter(row => row.root !== dominant)] : rows
}
