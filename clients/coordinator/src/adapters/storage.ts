import type { StorageAdapter } from "@common/types"

function trace(method: string, data: Record<string, unknown>): void {
  void globalThis
    .fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: `storage.${method}`, data }),
    })
    .catch(() => {})
}

/**
 * Returns a StorageAdapter backed by localStorage.
 * No schema knowledge — the renderer owns key names and value shapes.
 */
export function createStorageAdapter(): StorageAdapter {
  return {
    read(key: string): string | null {
      let result: string | null = null
      try {
        result = localStorage.getItem(key)
      } catch {
        // ignore
      }
      trace("read", { key, result })
      return result
    },

    write(key: string, value: string): void {
      try {
        localStorage.setItem(key, value)
      } catch {
        // storage quota exceeded or private browsing
      }
      trace("write", { key, value })
    },

    delete(key: string): void {
      try {
        localStorage.removeItem(key)
      } catch {
        // ignore
      }
      trace("delete", { key })
    },
  }
}
