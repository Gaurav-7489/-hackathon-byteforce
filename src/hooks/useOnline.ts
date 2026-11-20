import { useSyncExternalStore } from 'react'

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
