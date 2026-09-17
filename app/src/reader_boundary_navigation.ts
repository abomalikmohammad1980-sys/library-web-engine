export function readerBoundaryIndex(total: number, boundary: 'first' | 'last'): number {
  const safeTotal = Math.max(1, Math.floor(total) || 1)
  return boundary === 'first' ? 0 : safeTotal - 1
}
