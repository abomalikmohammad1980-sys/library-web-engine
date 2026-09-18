import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const home = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
const screens = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')
const components = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('هوية بطل الرئيسية والزخرفة العامة', () => {
  it('يعرض الشعار والآية والحديث ويبرز اسم الخزانة', () => {
    expect(home).toContain("brandMark('home-hero__logo brand-mark')")
    expect(home).toContain('وَقُل رَّبِّ زِدْنِي عِلْمًا')
    expect(home).toContain('طلب العلم فريضة على كل مسلم')
    expect(home).toContain("class: 'home-hero__title-brand'")
    expect(screens).toContain('.home-hero__brand')
    expect(screens).toContain('font-family: var(--font-quran)')
  })

  it('يستعمل مشهد الخزانة وزخرفة ثابتة دون إعادة رسم مستمرة', () => {
    expect(screens).toContain('.home-hero__landscape')
    expect(screens).toContain('clip-path: polygon')
    expect(components).toContain('.app-main::before')
    expect(components).toContain('mask-image: linear-gradient')
    expect(components).not.toContain('animation: khizana-motif-drift')
  })
})
