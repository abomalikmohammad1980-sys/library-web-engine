import { expect, it } from 'vitest'
import { fitCoverTextBatch } from './cover_text_fit'

it('preserves the binary-search result for different title and author limits', () => {
  const sizes = [0, 0, 0]
  const limits = [7.125, 10.5, 18]
  fitCoverTextBatch(limits.map((limit, index) => ({
    maximum: 20,
    write: size => { sizes[index] = size },
    fits: () => sizes[index]! <= limit,
  })))
  limits.forEach((limit, index) => {
    expect(sizes[index]).toBeLessThanOrEqual(limit)
    expect(limit - sizes[index]!).toBeLessThan(20 / 1024)
  })
})

it('does not alternate writes and layout reads per cover', () => {
  const phases: string[] = []
  fitCoverTextBatch(Array.from({ length: 40 }, () => ({
    maximum: 20, write: () => { phases.push('write') }, fits: () => { phases.push('read'); return true },
  })))
  expect(phases.join(',')).toBe([
    ...Array.from({ length: 10 }, () => [...Array(40).fill('write'), ...Array(40).fill('read')]).flat(),
    ...Array(40).fill('write'),
  ].join(','))
})
