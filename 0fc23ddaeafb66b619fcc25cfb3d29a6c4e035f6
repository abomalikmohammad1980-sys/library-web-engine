/** حالة اتصال موحدة لقشرة الويب والتطبيقات المغلفة. */

export interface ConnectivityState {
  online: boolean
  message: string
}

export function connectivityState(online: boolean): ConnectivityState {
  return online
    ? { online: true, message: 'عاد الاتصال بالإنترنت.' }
    : { online: false, message: 'أنت دون اتصال؛ كتبك وبياناتك المحلية متاحة، وستنتظر العمليات الشبكية عودة الاتصال.' }
}

type Listener = (state: ConnectivityState) => void
const listeners = new Set<Listener>()

function current(): ConnectivityState {
  return connectivityState(typeof navigator === 'undefined' ? true : navigator.onLine)
}

function notify(): void {
  const state = current()
  listeners.forEach(listener => listener(state))
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
}

export function watchConnectivity(listener: Listener): () => void {
  listeners.add(listener)
  listener(current())
  return () => listeners.delete(listener)
}

