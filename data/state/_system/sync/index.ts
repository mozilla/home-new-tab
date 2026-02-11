import { safeJsonParse } from "@common/utilities/values"

import type { SyncFrame, SyncMeta } from "../types"

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
 * - ignore sync frames authored by this tab (updatedBy === tabId) to prevent ping-pong loops.
 */

const TAB_ID_KEY = "app:tabId"
let cachedTabId: string | null = null

/**
 * __resetTabIdCache (TEST ONLY)
 * ---
 * Resets the module-level cached tab ID.
 * Only use this in tests for proper isolation between test cases.
 *
 * @internal
 */
export function __resetTabIdCache(): void {
  cachedTabId = null
}

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
   * Parse a raw localStorage value into a sync frame.
   * Return null to ignore (wrong shape/version).
   */
  readIncoming: (
    raw: string,
  ) => { incoming: SyncFrame<TData>; updatedBy: string } | null

  /**
   * Apply an incoming sync frame to the store.
   * Return true if anything meaningful changed.
   */
  applyIncoming: (incoming: SyncFrame<TData>) => boolean

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
 * readIncomingSyncFrame
 * ---
 * Parse and validate a raw sync frame from a storage event.
 *
 * Extracts both the sync frame data and the updatedBy field in one pass.
 * The updatedBy field is pulled out separately so the caller can quickly
 * check if this event came from the current tab (for echo prevention)
 * before doing any expensive merge operations.
 *
 * Returns null if the sync frame is malformed or missing required sync metadata.
 */
export function readIncomingSyncFrame<TData>(
  raw: string,
): { incoming: SyncFrame<TData>; updatedBy: string } | null {
  const parsed = safeJsonParse(raw) as SyncFrame<TData> | null
  const updatedBy = parsed?.sync?.updatedBy
  if (!updatedBy) return null
  return { incoming: parsed, updatedBy }
}

/**
 * Helpers specific to the State System.
 *
 * Guideline:
 * - If a helper is truly generic, prefer @common/utilities.
 * - If it exists mainly to support this system, keep it here.
 */

/**
 * isIncomingNewer
 * ---
 * Deterministic comparison to decide if an incoming sync frame is newer than the current one.
 *
 * Three-level tie-breaking ensures convergence without oscillation:
 * 1. Higher rev wins
 * 2. If rev tied, higher updatedAtMs wins
 * 3. If still tied, lexicographic updatedBy comparison (deterministic final tie-breaker)
 */
export function isIncomingNewer(
  incoming: SyncMeta,
  current: SyncMeta,
): boolean {
  if (incoming.rev !== current.rev) return incoming.rev > current.rev
  if (incoming.updatedAtMs !== current.updatedAtMs)
    return incoming.updatedAtMs > current.updatedAtMs

  // Deterministic final tie-breaker to avoid flip-flops.
  return incoming.updatedBy > current.updatedBy
}

/**
 * mergeLww
 * ---
 * Default merge policy: full-frame Last-Write-Wins.
 *
 * Simple, deterministic, and easy to reason about.
 * Compares sync metadata and returns whichever sync frame is newer.
 */
export function mergeLww<TData>(
  local: SyncFrame<TData>,
  incoming: SyncFrame<TData>,
): SyncFrame<TData> {
  return isIncomingNewer(incoming.sync, local.sync) ? incoming : local
}

/**
 * readRawSyncFrame
 * ---
 * Read and parse a sync frame from localStorage.
 *
 * Optional migrate hook allows schema validation and transformation.
 * Optional onError hook called when read/parse fails (for observability).
 * Returns null if storage is empty, malformed, or migration rejects it.
 * SSR-safe (returns null if window is undefined).
 */
export function readRawSyncFrame<TData>(
  storageKey: string,
  migrate?: (incoming: unknown) => SyncFrame<TData> | null,
  onError?: (err: unknown) => void,
): SyncFrame<TData> | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null

    const parsedUnknown = safeJsonParse(raw)
    if (parsedUnknown == null) {
      if (onError) {
        onError({
          context: "readRawSyncFrame",
          storageKey,
          reason: "parse_failed",
        })
      }
      return null
    }

    if (migrate) {
      const migrated = migrate(parsedUnknown)
      if (migrated === null && onError) {
        onError({
          context: "readRawSyncFrame",
          storageKey,
          reason: "migration_rejected",
          raw: parsedUnknown,
        })
      }
      return migrated
    }

    // Minimal structural check (without heavy runtime validators).
    const parsed = parsedUnknown as SyncFrame<TData>
    const updatedBy = parsed?.sync?.updatedBy
    if (!updatedBy) {
      if (onError) {
        onError({
          context: "readRawSyncFrame",
          storageKey,
          reason: "invalid_sync_metadata",
        })
      }
      return null
    }
    return parsed
  } catch (err) {
    if (onError) {
      onError({
        context: "readRawSyncFrame",
        storageKey,
        error: err,
      })
    }
    return null
  }
}

/**
 * writeRawSyncFrame
 * ---
 * Write a sync frame to localStorage as raw JSON.
 *
 * Returns true on success, false on failure (e.g., quota exceeded).
 * On failure, calls onError callback with context for observability.
 *
 * Intentionally allows JSON.stringify to throw if data is not serializable.
 * This surfaces serialization bugs early in development.
 * SSR-safe (no-op if window is undefined, returns true).
 */
export function writeRawSyncFrame<TData>(
  storageKey: string,
  frame: SyncFrame<TData>,
  onError?: (err: unknown) => void,
): boolean {
  if (typeof window === "undefined") return true

  try {
    // Intentionally allow stringify to throw in dev if shared.data is not serializable.
    const serialized = JSON.stringify(frame)
    window.localStorage.setItem(storageKey, serialized)
    return true
  } catch (err) {
    // Call error hook with context for debugging/telemetry
    if (onError) {
      onError({
        context: "writeRawSyncFrame",
        storageKey,
        error: err,
        isQuotaError:
          err instanceof Error && err.name === "QuotaExceededError",
      })
    }
    return false
  }
}
