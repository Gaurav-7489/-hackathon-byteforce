import { useSyncExternalStore } from 'react'
import { sfx } from './sound'

/** Minimal toast store (success / failure / warning) with an accessible live region. */
export type ToastTone = 'success' | 'error' | 'warning' | 'info'
export interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

let items: ToastItem[] = []
let next = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function push(tone: ToastTone, title: string, description?: string) {
  if (tone === 'success') sfx.success()
  else if (tone === 'error') sfx.error()
  else if (tone === 'warning') sfx.warn()
  const id = ++next
  items = [...items.slice(-3), { id, tone, title, description }]
  emit()
  setTimeout(() => dismiss(id), tone === 'error' || tone === 'warning' ? 6500 : 4200)
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export const toast = Object.assign((title: string, description?: string) => push('info', title, description), {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  warning: (title: string, description?: string) => push('warning', title, description),
})

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => items,
    () => items,
  )
}
