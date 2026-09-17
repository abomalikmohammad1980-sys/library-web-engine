/** Preserve readiness events received while a result snapshot is in flight. */
export class SearchReadiness {
  private revision = 0
  capture(): number { return this.revision }
  changed(): void { this.revision++ }
  needsRefresh(captured: number): boolean { return captured !== this.revision }
}
export function pendingSearchDescription(ids:readonly string[],format:(n:number)=>string):string {
  const books=new Set(ids.filter(id=>id!=='local-formats')).size
  const local=ids.includes('local-formats')
  if(local&&!books)return 'نتائج أولية سريعة؛ يجري استكمال فهرسة الكتب المحلية.'
  return `نتائج أولية سريعة؛ بقي ${format(books)} كتابًا لاستكمال التغطية.${local?' ويجري استكمال فهرسة الكتب المحلية.':''}`
}
export function clearSearchResultSummary(scope:Pick<HTMLElement,'querySelectorAll'>):void {
  scope.querySelectorAll('.search-scope__results-footer, .search-scope__results-tools, .search-results__mode').forEach(element=>element.remove())
}
