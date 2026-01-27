import { safeJsonParse } from "./utilities"

import type { Snapshot } from "./types"

/**
 * Cross-tab sync plumbing (storage events + visibility events + tabId)
 * ---------------------------------------------------------
 * This file is intentionally "plumbing":
 * - Most devs should not need to edit it.
 * - It is designed to be small, readable, and well-commented.
 *
 * Transport:
 * - storage events: when a tab writes localStorage[storageKey], other tabs are notified.
 *
 * Echo guard:
 * - ignore snapshots authored by this tab (updatedBy === tabId) to prevent ping-pong loops.
 */

const TAB_ID_KEY = "app:tabId"
let cachedTabId: string | null = null

/**
 * fallbackId
 * ---
 * Generate a reasonably unique tab identifier when crypto.randomUUID is unavailable.
 *
 * Uses timestamp + random hex to minimize collision risk.
 * Not cryptographically secure, but sufficient for tab identification.
 */
function fallbackId(): string {
  return `tab_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/**
 * getOrCreateTabId
 * ---
 * Get or create a unique identifier for this browser tab.
 *
 * The ID is stored in sessionStorage so it:
 * - Persists across page reloads within the same tab
 * - Is NOT shared across different tabs/windows
 * - Disappears when the tab is closed
 *
 * This is what allows tabs to recognize their own events and avoid echo loops.
 * Uses crypto.randomUUID when available, falls back to timestamp-based ID otherwise.
 * SSR-safe (returns "ssr" when window is undefined).
 */
export function getOrCreateTabId(): string {
  if (cachedTabId) return cachedTabId
  if (typeof window === "undefined") return "ssr"

  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY)
    if (existing) {
      cachedTabId = existing
      return existing
    }

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : fallbackId()

    window.sessionStorage.setItem(TAB_ID_KEY, id)
    cachedTabId = id
    return id
  } catch {
    cachedTabId = cachedTabId ?? fallbackId()
    return cachedTabId
  }
}

export type CrossTabSyncOptions<TData> = {
  storageKey: string
  tabId: string
  nowMs: () => number
  onError: (err: unknown) => void

  /**
   * Parse a raw localStorage value into a snapshot.
   * Return null to ignore (wrong shape/version).
   */
  readIncoming: (
    raw: string,
  ) => { incoming: Snapshot<TData>; updatedBy: string } | null

  /**
   * Apply an incoming snapshot to the store.
   * Return true if anything meaningful changed.
   */
  applyIncoming: (incoming: Snapshot<TData>) => boolean

  /**
   * Nudge the UI to snap derived values immediately.
   */
  bumpUi: () => void

  /**
   * Optional visibility hook.
   * Return true if UI should snap.
   */
  onVisibilityChange?: (isVisible: boolean, nowMs: number) => boolean
}

/**
 * initCrossTabSync
 * ---
 * Wire up event listeners for cross-tab state synchronization.
 *
 * Sets up two types of listeners:
 * 1. Storage events - fired when another tab writes to localStorage
 * 2. Visibility events - fired when this tab becomes visible/hidden (optional)
 *
 * Echo prevention: Ignores storage events authored by this tab (via tabId comparison)
 * to prevent infinite ping-pong loops between tabs.
 *
 * Call this once during app initialization. Returns a cleanup function
 * that removes all event listeners (useful for unmounting or testing).
 * SSR-safe (returns no-op cleanup if window is undefined).
 */
export function initCrossTabSync<TData>(
  opts: CrossTabSyncOptions<TData>,
): () => void {
  if (typeof window === "undefined") return () => {}

  const onStorage = (e: StorageEvent) => {
    if (e.key !== opts.storageKey) return
    if (!e.newValue) return

    try {
      const parsed = opts.readIncoming(e.newValue)
      if (!parsed) return

      // Critical: ignore events authored by this tab (prevents ping-pong).
      if (parsed.updatedBy === opts.tabId) return

      const changed = opts.applyIncoming(parsed.incoming)
      if (changed) opts.bumpUi()
    } catch (err) {
      opts.onError(err)
    }
  }

  const onVisibility = () => {
    if (!opts.onVisibilityChange) return
    if (typeof document === "undefined") return

    const visible = !document.hidden
    const changed = opts.onVisibilityChange(visible, opts.nowMs())
    if (changed) opts.bumpUi()
  }

  window.addEventListener("storage", onStorage)

  if (opts.onVisibilityChange && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility)
    onVisibility() // prime once (some browsers fire late)
  }

  return () => {
    window.removeEventListener("storage", onStorage)
    if (opts.onVisibilityChange && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }
}

/**
 * readIncomingSnapshot
 * ---
 * Parse and validate a raw snapshot from a storage event.
 *
 * Extracts both the snapshot data and the updatedBy field in one pass.
 * The updatedBy field is pulled out separately so the caller can quickly
 * check if this event came from the current tab (for echo prevention)
 * before doing any expensive merge operations.
 *
 * Returns null if the snapshot is malformed or missing required sync metadata.
 */
export function readIncomingSnapshot<TData>(
  raw: string,
): { incoming: Snapshot<TData>; updatedBy: string } | null {
  const parsed = safeJsonParse(raw) as Snapshot<TData> | null
  const updatedBy = parsed?.sync?.updatedBy
  if (!updatedBy) return null
  return { incoming: parsed, updatedBy }
}
