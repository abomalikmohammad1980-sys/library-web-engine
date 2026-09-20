/* نقطة الإقلاع */

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css?initial'
import './styles/screens.css?initial'
import { applyStoredSettings } from './settings_store'
import { installSelectionTranslation } from './selection_translation'
import { cloudflareAccessAuthProvider } from './account_service'
import { backgroundDataRouteAllowed, createBackgroundDataScheduler } from './background_data_scheduler'
import { createServiceWorkerReloadGate } from './service_worker_reload_gate'
import { registerServiceWorkerUpdate } from './service_worker_update'
import {createServiceWorkerInteractionGuard,createServiceWorkerUpdateCheck} from './service_worker_refresh'

import { render } from './router'
import {installPathNavigation} from './path_location'

installPathNavigation()
window.addEventListener('popstate', () => render(true))
// أي إبطال للجلسة (خروج صريح أو 401/403 من API) يعيد بناء الشاشة فورًا؛
// فلا تبقى بيانات الحساب أو إضافات المراجعة ظاهرة بعد زوال الصلاحية.
window.addEventListener('alkhizana:account-changed', () => render(false))
applyStoredSettings()
render(false)
installSelectionTranslation()
// Warm local search indexes after the initial interface, and after imports.
void import('./background_search_index').then(module=>module.installBackgroundSearchIndex()).catch(()=>undefined)
// الجلسة مصدرها الخادم فقط؛ بعد التحقق نعيد رسم الصفحة كي تظهر مساحة الحساب
// أو أدوات الإدارة من claims الموقعة، بلا قراءة دور من localStorage.
// installTrustedRuntimeClaims يطلق account-changed؛ لا نكرر الرسم هنا.
void cloudflareAccessAuthProvider.currentSession().catch(()=>undefined)
// لا تنافس المصالحة الأولى وقراءة IndexedDB تحميل الشاشة الحالية أو بدء البحث.
// الموجّه يمهّد chunk القارئ وحده؛ أما البيانات العامة فتبدأ بعد أول خمول حقيقي.
const startBackgroundData = async (): Promise<void> => {
  try {
    const { ensurePublishedLibrarySeeded } = await import('./published_library_seed')
    await ensurePublishedLibrarySeeded()
    // Screens load author metadata when needed; speculative download competes
    // with the first paint even when no author details are visible.
  } catch (error) { console.warn('published_library_seed_failed', error) }
}
// نفحص الحالة مرة عند الجدولة ومرة عند التنفيذ، فلا ينفذ مؤقت قديم
// بعد الانتقال إلى القراءة أو الحسابات. تحميل السنة يبقى عند فتح قسمها.
const backgroundDataScheduler = createBackgroundDataScheduler({
  canRun: () => document.visibilityState === 'visible' && backgroundDataRouteAllowed(routeLocation.hash),
  idle: callback => 'requestIdleCallback' in window
    ? window.requestIdleCallback(callback, { timeout: 4000 })
    : globalThis.setTimeout(callback, 1400),
  run: startBackgroundData,
})
window.addEventListener('popstate', () => backgroundDataScheduler.notify())
document.addEventListener('visibilitychange', () => backgroundDataScheduler.notify())
backgroundDataScheduler.notify()

// Resume known private Word jobs only after idle; never parse on the initial route.
let wordResumeScheduled=false
function scheduleWordIndexResume():void{
 if(wordResumeScheduled||document.visibilityState!=='visible'||!backgroundDataRouteAllowed(routeLocation.hash))return
 wordResumeScheduled=true
 const run=()=>{wordResumeScheduled=false;if(document.visibilityState!=='visible'||!backgroundDataRouteAllowed(routeLocation.hash))return;void import('./local_index_status').then(module=>module.resumeImportedWordIndexing()).catch(()=>undefined)}
 if('requestIdleCallback' in window)window.requestIdleCallback(run,{timeout:4000});else globalThis.setTimeout(run,1400)
}
window.addEventListener('popstate',scheduleWordIndexResume)
window.addEventListener('alkhizana:account-changed',scheduleWordIndexResume)
document.addEventListener('visibilitychange',scheduleWordIndexResume)
scheduleWordIndexResume()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // عامل الخدمة يفعّل النسخة الجديدة فورًا (skipWaiting)، لكن التبويب المفتوح
  // يظل عادةً يشغّل ملفات النسخة السابقة حتى تحديث يدوي آخر. هذا كان يجعل
  // إصلاحات القارئ — ومنها الفهرس — تظهر في جلسة وتغيب بعد فتح مباشر. عند
  // انتقال السيطرة نعيد التحميل مرة واحدة كي تكون HTML وJS وCSS من الإصدار نفسه.
  const serviceWorkerReloadGate = createServiceWorkerReloadGate(Boolean(navigator.serviceWorker.controller))
  const interactionGuard=createServiceWorkerInteractionGuard()
  const safeReload=()=>navigator.onLine&&interactionGuard.safe(document,routeLocation.hash)
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type!=='khizana:check-safe-update'||event.ports.length!==1)return
    if(!(event.source instanceof ServiceWorker)||event.source.scriptURL!==new URL('/sw.js',location.origin).href)return
    event.ports[0]!.postMessage({safe:safeReload()})
    event.ports[0]!.close()
  })
  const checkUpdate=createServiceWorkerUpdateCheck(()=>registerServiceWorkerUpdate(navigator.serviceWorker))
  let refreshTimer:ReturnType<typeof setTimeout>|undefined
  const refreshAtSafePoint=(force=false)=>{
    clearTimeout(refreshTimer)
    refreshTimer=setTimeout(()=>{
      if(!safeReload())return
      if(serviceWorkerReloadGate.online(true)){location.reload();return}
      void checkUpdate(force)
    },500)
  }
  document.addEventListener('input',event=>interactionGuard.edited(event.target),true)
  document.addEventListener('change',event=>interactionGuard.edited(event.target),true)
  document.addEventListener('visibilitychange',()=>refreshAtSafePoint())
  document.addEventListener('focusout',()=>refreshAtSafePoint())
  window.addEventListener('popstate',()=>refreshAtSafePoint())
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (serviceWorkerReloadGate.controllerChanged(Boolean(navigator.serviceWorker.controller), navigator.onLine,safeReload())) location.reload()
  })
  window.addEventListener('online', () => refreshAtSafePoint(true))
  window.addEventListener('load', () => {
    void registerServiceWorkerUpdate(navigator.serviceWorker).then(ok=>{if(!ok)console.warn('service_worker_update_unavailable')})
  })
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // لا يجوز أن يعيد عامل خدمة من معاينة إنتاجية قديمة واجهة مخزنة فوق Vite.
  // ننظف النطاق المحلي مرة واحدة ثم نعيد التحميل إن كان التبويب تحت سيطرته.
  window.addEventListener('load', () => {
    void (async () => {
      const hadController = Boolean(navigator.serviceWorker.controller)
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.unregister()))
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.filter(key => key.startsWith('alkhizana-')).map(key => caches.delete(key)))
      }
      const reloadKey = 'alkhizana:dev-sw-cleaned'
      if (hadController && sessionStorage.getItem(reloadKey) !== '1') {
        sessionStorage.setItem(reloadKey, '1')
        location.reload()
      } else {
        sessionStorage.removeItem(reloadKey)
      }
    })().catch(error => console.warn('dev_service_worker_cleanup_failed', error))
  })
}
import {routeLocation} from "./path_location"
