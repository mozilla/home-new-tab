/**
 * Storage Event Utilities - Helpers for testing storage events
 *
 * Provides utilities for creating and dispatching storage events in tests,
 * which are used to simulate cross-tab communication via localStorage.
 */

/**
 * Create a StorageEvent for testing
 *
 * Storage events are fired by the browser when localStorage is modified
 * in another tab/window. This factory creates events that match the
 * browser's behavior for testing cross-tab sync.
 *
 * @param key - The storage key that changed
 * @param newValue - The new value (null for deletions)
 * @param oldValue - The previous value (optional)
 * @param storageArea - The Storage object (default: window.localStorage)
 *
 * Usage:
 * ```typescript
 * const event = createStorageEvent('app:timer', JSON.stringify(snapshot))
 * window.dispatchEvent(event)
 * ```
 */
export function createStorageEvent(
  key: string,
  newValue: string | null,
  oldValue: string | null = null,
  storageArea: Storage = window.localStorage,
): StorageEvent {
  return new StorageEvent("storage", {
    key,
    newValue,
    oldValue,
    storageArea,
    url: typeof window !== "undefined" ? window.location.href : "",
  })
}

/**
 * Dispatch a storage event to simulate a write from another tab
 *
 * This is a convenience wrapper around createStorageEvent + dispatchEvent.
 *
 * @param key - The storage key that changed
 * @param value - The new value
 *
 * Usage:
 * ```typescript
 * dispatchStorageEvent('app:timer', JSON.stringify(snapshot))
 * // Listeners will receive the event as if another tab wrote to storage
 * ```
 */
export function dispatchStorageEvent(
  key: string,
  value: string | null,
): void {
  if (typeof window === "undefined") return
  const event = createStorageEvent(key, value)
  window.dispatchEvent(event)
}
