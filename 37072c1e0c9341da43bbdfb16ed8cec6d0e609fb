import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TRANSLATION_LANGUAGES } from './translation'
import { UI_TRANSLATIONS } from './ui_translations'
import { GENERATED_EN_UI } from './i18n/en.generated'
import { REVIEWED_EN_UI } from './i18n/en.reviewed'
import { GENERATED_FR_UI } from './i18n/fr.generated'
import { REVIEWED_FR_UI } from './i18n/fr.reviewed'

describe('translation feature contract', () => {
  it('offers more than thirty searchable living languages including requested Muslim languages', () => {
    expect(TRANSLATION_LANGUAGES.length).toBeGreaterThanOrEqual(30)
    expect(TRANSLATION_LANGUAGES.map(language => language.code)).toEqual(expect.arrayContaining(['ug', 'sw', 'hu', 'hi', 'ur']))
    expect(new Set(TRANSLATION_LANGUAGES.map(language => language.code)).size).toBe(TRANSLATION_LANGUAGES.length)
    expect(Object.keys(UI_TRANSLATIONS).sort()).toEqual(TRANSLATION_LANGUAGES.map(language => language.code).sort())
    for (const language of TRANSLATION_LANGUAGES) expect(Object.keys(UI_TRANSLATIONS[language.code] ?? {}).length).toBeGreaterThanOrEqual(10)
  })

  it('places Uyghur fourth in the visible picker after Arabic, English, and French', () => {
    const visibleCodes = ['ar', ...TRANSLATION_LANGUAGES.map(language => language.code)]
    expect(visibleCodes.slice(0, 4)).toEqual(['ar', 'en', 'fr', 'ug'])
    expect(TRANSLATION_LANGUAGES[2]).toMatchObject({ code: 'ug', native: 'ئۇيغۇرچە', dir: 'rtl' })
  })

  it('keeps every language native name in its original script', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'translation.ts'), 'utf8')
    expect(source.match(/nativeLanguageName\(language\)/g)).toHaveLength(2)
    expect(source).toContain("dataset: { noTranslate: 'true' }")
    expect(source).toContain("native.setAttribute('lang', language.code)")
  })

  it('translates accessible names, hints, and placeholders from the local dictionary and restores Arabic', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'translation.ts'), 'utf8')
    expect(source).toContain("const UI_TRANSLATABLE_ATTRIBUTES = ['aria-label', 'placeholder', 'title'] as const")
    expect(source).toContain('translateKnownUiAttributes(target)')
    expect(source).toContain('restoreOriginalUiAttributes()')
    expect(source).toContain("element.closest('.reading__page-slot,.reader__pdf-viewport,[data-no-translate]')")
  })

  it('ships the complete generated English UI inventory locally', () => {
    expect(Object.keys(GENERATED_EN_UI)).toHaveLength(1380)
    expect(Object.keys(REVIEWED_EN_UI).length).toBeGreaterThanOrEqual(90)
    expect(UI_TRANSLATIONS.en['تعذّر فتح الكتاب الآن']).toBe('This book could not be opened.')
    expect(UI_TRANSLATIONS.en['الرئيسية']).toBe('Home')
    expect(UI_TRANSLATIONS.en['ورد القراءة اليومي']).toBe('Daily reading goal')
    expect(UI_TRANSLATIONS.en['الباحث الشامل']).toBe('Library-wide search')
  })

  it('ships a complete French inventory with reviewed library terminology', () => {
    expect(Object.keys(GENERATED_FR_UI)).toHaveLength(1380)
    expect(Object.keys(REVIEWED_FR_UI).length).toBeGreaterThanOrEqual(100)
    expect(UI_TRANSLATIONS.fr['التخريج والأطراف']).toBe('Référencement et concordances des hadiths')
    expect(UI_TRANSLATIONS.fr['ورد القراءة اليومي']).toBe('Objectif de lecture quotidien')
    expect(UI_TRANSLATIONS.fr['الباحث الشامل']).toBe('Recherche globale')
  })

  it('keeps translation credentials server-side and sends only explicit text', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'translation.ts'), 'utf8')
    expect(source).toContain("fetch('/api/translate'")
    expect(source).not.toMatch(/api[_-]?key|bearer\s/i)
    expect(source).toContain('6000')
    const endpoint = readFileSync(resolve(import.meta.dirname, '../../alpha-publish/functions/api/translate.js'), 'utf8')
    expect(endpoint).toContain('freePublicTranslation')
    expect(endpoint).toContain('public-free-fallback')
  })

  it('exposes translation from header, footer, and textual reader selection', () => {
    const shell = readFileSync(resolve(import.meta.dirname, 'shell.ts'), 'utf8')
    const reader = readFileSync(resolve(import.meta.dirname, 'screens/reader.ts'), 'utf8')
    const source = readFileSync(resolve(import.meta.dirname, 'translation.ts'), 'utf8')
    expect(shell).toContain("translationButton('app-header__translation')")
    expect(shell).not.toContain("translationButton('site-footer__translation')")
    expect(shell).toContain("'aria-label': `ألوان الخِزانة — ${themeNames[selectedTheme]}`")
    expect(shell).not.toContain("class: 'app-header__theme-label'")
    expect(reader).toContain('openTranslationDialog(text)')
    expect(reader).toContain('reading__translate-page')
    expect(source).toContain('DAILY_REQUEST_LIMIT = 80')
    expect(source).toContain('translateMissingUiLabels')
    expect(source).toContain('تبقى البيانات المتغيرة بأصلها')
    expect(source).toContain('if (!resolved) { node.textContent = original; continue }')
    expect(source).toContain('[[KHZ_')
  })

  it('anchors the site-language picker under a visible translation button instead of a side modal', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'translation.ts'), 'utf8')
    const styles = readFileSync(resolve(import.meta.dirname, 'styles/components.css'), 'utf8')
    expect(source).toContain("'aria-label': 'اختيار لغة الموقع'")
    expect(source).not.toContain("translation-launch__label' }, 'ترجمة'")
    expect(source).toContain('openSiteLanguageDialog(button)')
    expect(source).toContain('dialog.show()')
    expect(source).not.toContain('dialog.showModal()\n  dialog.querySelector<HTMLInputElement>(\'.translation-dialog__filter\')?.focus()')
    expect(styles).toContain('.translation-dialog--anchored')
    expect(styles).toContain('top: var(--translation-popover-top')
    expect(styles).toContain('direction: inherit')
    expect(source).toContain("'aria-selected': selected ? 'true' : 'false'")
    expect(source).toMatch(/dialog\.show\(\)\s+\/\/[^\n]*\s+restoreSelectedSiteLanguage\(\)/)
  })

  it('reapplies the persisted language after every route is mounted', () => {
    const router = readFileSync(resolve(import.meta.dirname, 'router.ts'), 'utf8')
    const source = readFileSync(resolve(import.meta.dirname, 'translation.ts'), 'utf8')
    expect(router).toMatch(/import \{[^}]*restoreSelectedSiteLanguage[^}]*\} from '\.\/translation'/)
    expect(router).toMatch(/root\.replaceChildren\(content, globalRemembrance\(\)\)\s+\/\/[^\n]*\s+restoreSelectedSiteLanguage\(\)/)
    expect(router).toMatch(/root\.replaceChildren\(readerScreen\(bookId\), globalRemembrance\(\)\)\s+restoreSelectedSiteLanguage\(\)/)
    expect(source).toContain("localStorage.setItem(SITE_LANGUAGE_KEY, target.code)")
    expect(source).toContain("localStorage.removeItem(SITE_LANGUAGE_KEY)")
    expect(source).toContain("else localStorage.setItem(SITE_LANGUAGE_KEY, language.code)")
    expect(source).toContain('new MutationObserver(records =>')
    expect(source).toContain('{ childList: true, subtree: true }')
    expect(source).toContain('ensureDynamicTranslationObserver()')
    expect(source).toContain('if (language) translateKnownUiNodes(language)')
  })

  it('keeps book text out of UI translation while preserving Arabic source direction', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'translation.ts'), 'utf8')
    expect(source).toContain("element.closest('.reading__page-slot,.reader__pdf-viewport,[data-no-translate]')")
    expect(source).toContain("class: 'translation-dialog__source', dir: 'rtl'")
  })
})
