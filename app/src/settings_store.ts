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
export const INTERFACE_SCALE_MIN = 85
export const READER_SCALE_MIN = 80
export const ACCESSIBLE_SCALE_MAX = 200

function appTheme(value: unknown): AppTheme {
  return value === 'light' || value === 'dark' || value === 'sepia' ? value : 'original'
}

export function getSettings(): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AppSettings>
    return normalizeSettings({
      interfaceScale: Number(saved.interfaceScale) || DEFAULTS.interfaceScale,
      readerScale: Number(saved.readerScale) || DEFAULTS.readerScale,
      highContrast: Boolean(saved.highContrast),
      reduceMotion: Boolean(saved.reduceMotion),
      theme: appTheme(saved.theme),
    })
  } catch { return { ...DEFAULTS } }
}

export function saveSettings(settings: AppSettings): void {
  const normalized = normalizeSettings(settings)
  localStorage.setItem(KEY, JSON.stringify(normalized))
  applySettings(normalized)
  window.dispatchEvent(new CustomEvent('alkhizana:settings-changed', { detail: normalized }))
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

function normalizeSettings(settings: AppSettings): AppSettings {
  return { ...settings,
    interfaceScale: clamp(settings.interfaceScale, INTERFACE_SCALE_MIN, ACCESSIBLE_SCALE_MAX),
    readerScale: clamp(settings.readerScale, READER_SCALE_MIN, ACCESSIBLE_SCALE_MAX),
    theme: appTheme(settings.theme),
  }
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }
