import { readJson, writeJson } from "./_storage"

const STORAGE_KEY = "coordinator:context-id"

/**
 * getContextId
 * ---
 * Returns the persistent per-user context ID for MARS ad targeting.
 * Generated once on first use and stored in coordinator storage. The same
 * ID is reused across sessions so MARS can correlate ad interactions.
 *
 * In production, browser core may manage this lifecycle directly. The dev
 * implementation stores it in localStorage as a plain UUID string.
 */
export function getContextId(): string {
  const stored = readJson<string | null>(STORAGE_KEY, null)
  if (stored) return stored
  const id = crypto.randomUUID()
  writeJson(STORAGE_KEY, id)
  return id
}