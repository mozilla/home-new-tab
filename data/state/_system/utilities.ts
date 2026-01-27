import type { Snapshot, SyncMeta } from "./types"

/**
 * Utilities specific to the State System.
 *
 * Guideline:
 * - If a helper is truly generic, prefer @common/utilities.
 * - If it exists mainly to support this system, keep it here.
 */

/**
 * isIncomingNewer
 * ---
 * Deterministic comparison to decide if an incoming snapshot is newer than the current one.
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
 * Default merge policy: full-snapshot Last-Write-Wins.
 *
 * Simple, deterministic, and easy to reason about.
 * Compares sync metadata and returns whichever snapshot is newer.
 */
export function mergeLww<TData>(
  local: Snapshot<TData>,
  incoming: Snapshot<TData>,
): Snapshot<TData> {
  return isIncomingNewer(incoming.sync, local.sync) ? incoming : local
}

/**
 * safeJsonParse
 * ---
 * Parse JSON with graceful fallback.
 *
 * Returns null instead of throwing if the input is malformed.
 * Useful for reading potentially corrupted localStorage values.
 */
export function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

/**
 * readRawSnapshot
 * ---
 * Read and parse a snapshot from localStorage.
 *
 * Optional migrate hook allows schema validation and transformation.
 * Returns null if storage is empty, malformed, or migration rejects it.
 * SSR-safe (returns null if window is undefined).
 */
export function readRawSnapshot<TData>(
  storageKey: string,
  migrate?: (incoming: unknown) => Snapshot<TData> | null,
): Snapshot<TData> | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null

  const parsedUnknown = safeJsonParse(raw)
  if (parsedUnknown == null) return null

  if (migrate) return migrate(parsedUnknown)

  // Minimal structural check (without heavy runtime validators).
  const parsed = parsedUnknown as Snapshot<TData>
  const updatedBy = parsed?.sync?.updatedBy
  if (!updatedBy) return null
  return parsed
}

/**
 * writeRawSnapshot
 * ---
 * Write a snapshot to localStorage as raw JSON.
 *
 * Intentionally allows JSON.stringify to throw if data is not serializable.
 * This surfaces serialization bugs early in development.
 * SSR-safe (no-op if window is undefined).
 */
export function writeRawSnapshot<TData>(
  storageKey: string,
  snap: Snapshot<TData>,
): void {
  if (typeof window === "undefined") return

  // Intentionally allow stringify to throw in dev if shared.data is not serializable.
  window.localStorage.setItem(storageKey, JSON.stringify(snap))
}
