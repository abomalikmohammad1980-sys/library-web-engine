import { describe, expect, it } from 'vitest'
import { createSearchYieldScheduler } from './search_yield'

describe('search cooperative scheduler', () => {
  it('does not add a timer turn for every book', async () => {
    let time = 0
    let yields = 0
    const scheduler = createSearchYieldScheduler(16, () => time, async () => { yields += 1 })
    for (let book = 0; book < 10_000; book += 1) {
      time += 0.01
      await scheduler.checkpoint()
    }
    expect(yields).toBeGreaterThan(0)
    expect(yields).toBeLessThan(10)
  })

  it('yields after a slow indexing slice and resets its deadline', async () => {
    let time = 0
    let yields = 0
    const scheduler = createSearchYieldScheduler(10, () => time, async () => { yields += 1 })
    time = 11
    await scheduler.checkpoint()
    await scheduler.checkpoint()
    expect(yields).toBe(1)
    time = 22
    await scheduler.checkpoint()
    expect(yields).toBe(2)
  })
})
