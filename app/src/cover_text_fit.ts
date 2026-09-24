export interface CoverFitTarget {
  maximum: number
  write(size: number): void
  fits(): boolean
}

/** Write every candidate before measuring any, so one layout serves the batch. */
export function fitCoverTextBatch(targets: CoverFitTarget[]): void {
  const states = targets.map(target => ({ target, low: .25, high: target.maximum, size: 0 }))
  // Ten steps leave <0.02px of uncertainty at a 20px maximum while avoiding
  // six synchronous layout measurements for every visible cover.
  for (let iteration = 0; iteration < 10; iteration++) {
    for (const state of states) {
      state.size = (state.low + state.high) / 2
      state.target.write(state.size)
    }
    for (const state of states) {
      if (state.target.fits()) state.low = state.size
      else state.high = state.size
    }
  }
  for (const state of states) state.target.write(state.low)
}
