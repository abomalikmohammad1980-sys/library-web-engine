/** Background indexing may enrich results, but must not send a reader back
 * to page one while they are browsing later pages or an open preview. */
export function canAutoRefreshSearch(page: number, previewOpen: boolean): boolean {
  return page === 0 && !previewOpen
}
