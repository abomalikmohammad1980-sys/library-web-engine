/**
 * Cooperative scheduler for long local searches.
 *
 * Yielding once per book makes the timer clamp part of query latency (8,593
 * books can mean many seconds even when no text matches).  This scheduler
 * yields only after a bounded slice of actual work, keeping input responsive
 * without charging one timer turn per book.
 */
export interface SearchYieldScheduler {
  checkpoint(): Promise<void>
}

export function createSearchYieldScheduler(
  budgetMs = 16,
  now: () => number = () => performance.now(),
  yieldToBrowser: () => Promise<void> = () => new Promise(resolve => window.setTimeout(resolve, 0)),
): SearchYieldScheduler {
  let sliceStarted = now()
  return {
    async checkpoint(): Promise<void> {
      if (now() - sliceStarted < budgetMs) return
      await yieldToBrowser()
      sliceStarted = now()
    },
  }
}
