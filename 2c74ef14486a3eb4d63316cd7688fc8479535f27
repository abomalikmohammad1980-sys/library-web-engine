import { describe, expect, it } from 'vitest'
import { detectInstallPlatform, installCtaLabel, installGuidance, isStandalone } from './install'

describe('installable app contract', () => {
  it('recognises the major mobile and desktop platform families', () => {
    expect(detectInstallPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')).toBe('ios')
    expect(detectInstallPlatform('Mozilla/5.0 (Linux; Android 15)')).toBe('android')
    expect(detectInstallPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop')
    expect(detectInstallPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('desktop')
  })

  it('provides platform-specific instructions and detects installed display mode', () => {
    expect(installGuidance('ios')).toContain('الشاشة الرئيسية')
    expect(installGuidance('desktop')).toContain('شريط العنوان')
    expect(isStandalone(true, false)).toBe(true)
    expect(isStandalone(false, true)).toBe(true)
    expect(isStandalone(false, false)).toBe(false)
  })

  it('labels the install action honestly for prompt, guidance and installed states', () => {
    expect(installCtaLabel(false, true)).toContain('تثبيت')
    expect(installCtaLabel(false, false)).toContain('المتصفح')
    expect(installCtaLabel(true, false)).toContain('مثبت')
  })
})
