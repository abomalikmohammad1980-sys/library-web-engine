/* نقطة الإقلاع */

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/screens.css'
import { applyStoredSettings } from './settings_store'
import { ensureShamelaCatalogImported } from './shamela_catalog'
import { ensurePublishedLibrarySeeded } from './published_library_seed'

import { render } from './router'

window.addEventListener('hashchange', () => render(true))
applyStoredSettings()
render(false)
// كتالوج المؤلفين أصل من أصول الموقع، لا ينتظر فتح المكتبة أو استيراد كتاب.
void ensureShamelaCatalogImported().catch(error => console.warn('author_core_catalog_load_failed', error))
void ensurePublishedLibrarySeeded().catch(error => console.warn('published_library_seed_failed', error))

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => registration.update())
  })
}
