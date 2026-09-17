export function shouldRetrySearchTransient(previousSignature: string, signature: string, attempts: number): boolean {
  return previousSignature !== signature || attempts < 3
}
/** An engine generation change is not a user/navigation cancellation. */
export function isSearchStateInvalidation(error:unknown, signal:AbortSignal):boolean {
  return error instanceof DOMException && error.name==='AbortError' && !signal.aborted
}
