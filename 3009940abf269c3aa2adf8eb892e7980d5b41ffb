import { describe, expect, it } from 'vitest'
import { authorPortraitUpdate, MAX_AUTHOR_PORTRAIT_BYTES, validateAuthorPortrait } from './author_portrait_update'

describe('author portrait update', () => {
  it('removes both stored image fields explicitly', () => {
    expect(authorPortraitUpdate(true)).toEqual({ imageData: null, imageMimeType: null })
  })

  it('rejects unsupported, empty, and oversized files before reading bytes', () => {
    expect(validateAuthorPortrait({ type: 'image/svg+xml', size: 100 })).toContain('غير مدعومة')
    expect(validateAuthorPortrait({ type: 'image/png', size: 0 })).toContain('فارغ')
    expect(validateAuthorPortrait({ type: 'image/jpeg', size: MAX_AUTHOR_PORTRAIT_BYTES + 1 })).toContain('5 MB')
    expect(validateAuthorPortrait({ type: 'image/webp', size: 100 })).toBeUndefined()
  })

  it('prefers a newly selected image over a stale remove choice', () => {
    const data = new Uint8Array([1, 2, 3])
    expect(authorPortraitUpdate(true, { data, mimeType: 'image/png' })).toEqual({ imageData: data, imageMimeType: 'image/png' })
    expect(authorPortraitUpdate(false)).toEqual({})
  })
})
