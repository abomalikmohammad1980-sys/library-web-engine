export interface AppSettings {
  interfaceScale: number
  readerScale: number
  highContrast: boolean
  reduceMotion: boolean
  theme?: AppTheme
}

export type AppTheme = 'original' | 'light' | 'dark' | 'sepia'

const KEY = 'alkhizana:settings:v1'
const DEFAULTS: AppSettings = { interfaceScale: 100, readerScale: 100, highContrast: false, reduceMotion: false, theme: 'original' }

function appTheme(value: unknown): AppTheme {
  return value === 'light' || value === 'dark' || value === 'sepia' ? value : 'original'
}

export function getSettings(): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AppSettings>
    return {
      interfaceScale: clamp(Number(saved.interfaceScale) || DEFAULTS.interfaceScale, 85, 130),
      readerScale: clamp(Number(saved.readerScale) || DEFAULTS.readerScale, 80, 140),
      highContrast: Boolean(saved.highContrast),
      reduceMotion: Boolean(saved.reduceMotion),
      theme: appTheme(saved.theme),
    }
  } catch { return { ...DEFAULTS } }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
  applySettings(settings)
  window.dispatchEvent(new CustomEvent('alkhizana:settings-changed', { detail: settings }))
}

export function resetSettings(): AppSettings {
  localStorage.removeItem(KEY)
  const settings = { ...DEFAULTS }
  applySettings(settings)
  window.dispatchEvent(new CustomEvent('alkhizana:settings-changed', { detail: settings }))
  return settings
}

export function applyStoredSettings(): void { applySettings(getSettings()) }

function applySettings(settings: AppSettings): void {
  const root = document.documentElement
  if (!root) return
  root.style.setProperty('--interface-scale', String(settings.interfaceScale / 100))
  root.style.setProperty('--reader-scale', String(settings.readerScale / 100))
  root.style.setProperty('--reading-column', `calc(680px * ${settings.readerScale / 100})`)
  root.classList.toggle('a11y-high-contrast', settings.highContrast)
  root.classList.toggle('a11y-reduce-motion', settings.reduceMotion)
  const theme = appTheme(settings.theme)
  if (root.dataset) root.dataset.appTheme = theme
  else root.setAttribute?.('data-app-theme', theme)
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  const themeColors: Record<AppTheme, string> = { original: '#f1ede3', light: '#ffffff', dark: '#171816', sepia: '#eadcc3' }
  if (typeof document.querySelector === 'function') document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme])
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }
