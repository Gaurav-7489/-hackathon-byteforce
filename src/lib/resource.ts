/**
 * Tiny promise cache so Suspense + use() receive a *stable* promise per key
 * (creating a new promise each render would suspend forever).
 */
const cache = new Map<string, Promise<unknown>>()

export function resource<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (!p) {
    p = load()
    cache.set(key, p)
    // Failed loads must not be cached, so "Retry" can try again.
    p.catch(() => {
      if (cache.get(key) === p) cache.delete(key)
    })
  }
  return p
}

export function invalidate(prefix: string) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k)
}
