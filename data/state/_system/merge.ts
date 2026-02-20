import type { SyncFrame, SyncMeta } from "./types"

/**
 * Merge helpers
 * ---------------------------------------------------------
 * A merge policy decides what to do when we receive an incoming frame
 * and we already have a local frame.
 *
 * Default policy: deterministic last-write-wins (LWW).
 *
 * Custom policy:
 * - Not configurable per-store.
 * - If we ever add another policy, it gets implemented here and selected
 *   via a config enum (not a one-off function).
 *
 * Why so strict?
 * - Determinism matters. All tabs must converge on the same answer,
 *   even if messages arrive in a different order.
 */

/**
 * isIncomingNewer
 * ---
 * Deterministic ordering for two SyncMeta objects.
 *
 * Tie-break rules:
 * 1) Higher rev wins
 * 2) If rev tied, higher updatedAtMs wins
 * 3) If still tied, lexicographic updatedBy wins
 *
 * Lexicographic... fancy word for "string order".
 *
 * It's not "more correct" — it just guarantees every tab
 * makes the same decision when all other signals tie.
 */
export function isIncomingNewer(
  incoming: SyncMeta,
  current: SyncMeta,
): boolean {
  if (incoming.rev !== current.rev) return incoming.rev > current.rev
  if (incoming.updatedAtMs !== current.updatedAtMs) {
    return incoming.updatedAtMs > current.updatedAtMs
  }
  return incoming.updatedBy > current.updatedBy
}

/**
 * mergeLWW
 * ---
 * Full-frame last-write-wins merge policy.
 */
export function mergeLWW<TData>(
  local: SyncFrame<TData>,
  incoming: SyncFrame<TData>,
): SyncFrame<TData> {
  return isIncomingNewer(incoming.sync, local.sync) ? incoming : local
}
