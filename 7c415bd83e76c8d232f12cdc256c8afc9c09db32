import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8')

describe('lazy reader route', () => {
  it('keeps the heavy reader out of the initial application chunk', () => {
    expect(router).not.toContain("import { readerScreen } from './screens/reader'")
    expect(router).toContain("void import('./screens/reader')")
  })

  it('shows an honest accessible loading/error state and ignores stale route completion', () => {
    expect(router).toContain("title: 'جارٍ فتح القارئ'")
    expect(router).toContain("kind: 'error'")
    expect(router).toContain('generation !== renderGeneration')
    expect(router).toContain("parseHash(location.hash).name !== 'reader'")
  })
})
