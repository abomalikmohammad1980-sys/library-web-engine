import { expect, it } from 'vitest'
import { canAutoRefreshSearch } from './search_refresh_policy'

it('does not replace later pages or an open preview after background indexing', () => {
  expect(canAutoRefreshSearch(0, false)).toBe(true)
  expect(canAutoRefreshSearch(6, false)).toBe(false)
  expect(canAutoRefreshSearch(13, false)).toBe(false)
  expect(canAutoRefreshSearch(0, true)).toBe(false)
})
