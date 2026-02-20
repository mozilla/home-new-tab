import { safeJsonParse } from "@common/utilities/values"

import type { RestoreMode, SyncFrame } from "./types"

/**
 * Restore helpers
 * ---------------------------------------------------------
 * Restore answers one question:
 *   "When a store starts, do we have a snapshot we should start from?"
 *
 * We intentionally keep restore separate from live sync:
 * - Live sync is BroadcastChannel (handled elsewhere).
 * - Restore is localStorage (this file).
 *
 * Restore modes:
 * - "never"   -> no read, no write
 * - "device"  -> stable localStorage key per store (survives full close/reopen)
 * - "session" -> localStorage key scoped to an app sessionId
 *
 * Schema policy:
 * - If a stored snapshot has a different schemaVersion than the store expects,
 *   we treat it as invalid and start from initialData.
 * - This is intentional: localStorage is a cache, not critical persistence.
 */

const DEVICE_PREFIX = "app:restore:device:"
const SESSION_PREFIX = "app:restore:session:"

// Kept local on purpose; session.ts also writes this key.
// We read it only to enable best-effort synchronous session restore.
const APP_SESSION_ID_KEY = "app:sessionId"

export type RestoreReadArgs = {
  restore: RestoreMode
  syncKey: string

  /** Current schema version expected by the store. */
  schemaVersion: number

  onError?: (err: unknown) => void

  // Reserved for future use (currently we prefer wiping on schema changes).
  // migrate?: (incoming: unknown) => SyncFrame<TData> | null
}

export type RestoreWriteArgs<TData> = {
  restore: RestoreMode
  syncKey: string
  frame: SyncFrame<TData>
  onError?: (err: unknown) => void
}

/** Device restore storage key (stable across restarts). */
export function deviceRestoreKey(syncKey: string): string {
  return `${DEVICE_PREFIX}${syncKey}`
}

/** Session restore storage key (scoped to a specific app session). */
export function sessionRestoreKey(sessionId: string, syncKey: string): string {
  return `${SESSION_PREFIX}${sessionId}:${syncKey}`
}

/**
 * getCachedAppSessionId
 * ---
 * Best-effort synchronous read of the current app session id.
 *
 * - Returns null if unknown (e.g. a brand new tab that hasn't discovered it yet).
 * - Useful to avoid UI flicker on reload when sessionId is already cached.
 */
export function getCachedAppSessionId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage.getItem(APP_SESSION_ID_KEY)
  } catch {
    return null
  }
}

/**
 * readRestoreFrameSyncBestEffort
 * ---
 * Synchronous restore read for startup seeding.
 *
 * Behavior:
 * - never:   null
 * - device:  reads device key
 * - session: reads session key ONLY IF we already have a cached sessionId
 *
 * Schema:
 * - If the stored schemaVersion doesn't match args.schemaVersion, we ignore it.
 *
 * This keeps store creation synchronous while still enabling "instant restore"
 * in the common case (reload / same-tab refresh).
 */
export function readRestoreFrameSyncBestEffort<TData>(
  args: RestoreReadArgs,
): SyncFrame<TData> | null {
  if (args.restore === "never") return null

  if (args.restore === "device") {
    return readStoredSyncFrame<TData>(
      deviceRestoreKey(args.syncKey),
      args.schemaVersion,
      args.onError,
    )
  }

  // restore === "session"
  const sessionId = getCachedAppSessionId()
  if (!sessionId) return null

  return readStoredSyncFrame<TData>(
    sessionRestoreKey(sessionId, args.syncKey),
    args.schemaVersion,
    args.onError,
  )
}

/**
 * readStoredSyncFrame
 * ---
 * Read + parse a frame from localStorage.
 *
 * Returns null if:
 * - storage empty
 * - JSON parse fails
 * - schemaVersion mismatch (we wipe the stored value)
 * - missing required sync metadata
 */
export function readStoredSyncFrame<TData>(
  storageKey: string,
  expectedSchemaVersion: number,
  onError?: (err: unknown) => void,
): SyncFrame<TData> | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null

    const parsedUnknown = safeJsonParse(raw)
    if (parsedUnknown == null) {
      onError?.({
        context: "readStoredSyncFrame",
        storageKey,
        reason: "parse_failed",
      })
      return null
    }

    const frame = parsedUnknown as SyncFrame<TData>

    // Schema mismatch => treat as stale cache and wipe.
    if (frame.schemaVersion !== expectedSchemaVersion) {
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // ignore
      }

      onError?.({
        context: "readStoredSyncFrame",
        storageKey,
        reason: "schema_mismatch",
        expectedSchemaVersion,
        foundSchemaVersion: frame.schemaVersion,
      })

      return null
    }

    // Minimal structural guard (keep it light).
    if (!frame.sync?.updatedBy) {
      onError?.({
        context: "readStoredSyncFrame",
        storageKey,
        reason: "invalid_sync_metadata",
      })
      return null
    }

    return frame
  } catch (err) {
    onError?.({ context: "readStoredSyncFrame", storageKey, error: err })
    return null
  }
}

/**
 * writeRawSyncFrame
 * ---
 * Write a frame to localStorage as JSON.
 *
 * Returns true on success, false on failure (quota, serialization errors, etc).
 */
export function writeRawSyncFrame<TData>(
  storageKey: string,
  frame: SyncFrame<TData>,
  onError?: (err: unknown) => void,
): boolean {
  if (typeof window === "undefined") return true

  try {
    const serialized = JSON.stringify(frame)
    window.localStorage.setItem(storageKey, serialized)
    return true
  } catch (err) {
    onError?.({
      context: "writeRawSyncFrame",
      storageKey,
      error: err,
      isQuotaError: err instanceof Error && err.name === "QuotaExceededError",
    })
    return false
  }
}

/**
 * writeRestoreFrame
 * ---
 * Writes the latest frame to restore storage for the configured restore mode.
 *
 * - never: does nothing (returns true)
 * - device: writes stable key
 * - session: writes session-scoped key (requires sessionId)
 */
export function writeRestoreFrame<TData>(
  args: RestoreWriteArgs<TData> & { sessionId?: string | null },
): boolean {
  if (args.restore === "never") return true

  if (args.restore === "device") {
    return writeRawSyncFrame(
      deviceRestoreKey(args.syncKey),
      args.frame,
      args.onError,
    )
  }

  // restore === "session"
  const sessionId = args.sessionId ?? getCachedAppSessionId()
  if (!sessionId) {
    // If we don't know the session yet, we simply can't write session-scoped restore.
    // Once session discovery completes, callers can retry (usually via refresh/init flow).
    return true
  }

  return writeRawSyncFrame(
    sessionRestoreKey(sessionId, args.syncKey),
    args.frame,
    args.onError,
  )
}
