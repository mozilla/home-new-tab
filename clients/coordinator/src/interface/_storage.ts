/**
 * readJson
 * ---
 * Reads and parses a JSON value from localStorage, returning a typed fallback
 * if the key is absent or the value is malformed. Safe to call at any time.
 * Storage failures are swallowed and the fallback is returned.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * writeJson
 * ---
 * Serializes a value to JSON and writes it to localStorage. Safe to call at
 * any time. Storage failures are swallowed silently.
 */
export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable or quota exceeded — drop the write silently.
  }
}
