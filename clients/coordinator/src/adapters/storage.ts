import type { StorageAdapter } from "@common/types"

/**
 * Returns a StorageAdapter backed by localStorage.
 * No schema knowledge — the renderer owns key names and value shapes.
 */
export function createStorageAdapter(): StorageAdapter {
  return {
    read(key: string): string | null {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },

    write(key: string, value: string): void {
      try {
        localStorage.setItem(key, value)
      } catch {
        // storage quota exceeded or private browsing
      }
    },

    delete(key: string): void {
      try {
        localStorage.removeItem(key)
      } catch {
        // ignore
      }
    },
  }
}
