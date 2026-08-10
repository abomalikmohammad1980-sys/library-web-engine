import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('filter clear actions', () => {
  it('clears every library and admin control through the URL-sync path', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(source).toContain("'مسح المرشحات'")
    expect(source).toContain("categoryFilter.value = ''; authorState.value = ''; fromYear.value = ''; toYear.value = ''; sync()")
    expect(source).toContain("'مسح مرشحات الإدارة'")
    expect(source).toContain("categoryFilter.value = ''; stateFilter.value = ''; fromYear.value = ''; toYear.value = ''; syncAdminFilters()")
  })
})
