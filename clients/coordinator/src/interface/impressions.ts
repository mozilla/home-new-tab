import { readJson } from "./_storage"

// Storage key for impression timestamps. Defined here so browser core knows
// where to write when this stub is replaced with a real integration.
const STORAGE_KEY = "coordinator:impressions"

/**
 * getImpressionTimestamps
 * ---
 * Returns all recorded impression timestamps (ms) for a frequency cap key.
 * Used by the sponsored pipeline to evaluate per-cap limits before serving
 * an ad. Returns an empty array if nothing is recorded or storage fails.
 *
 * In dev, this always returns [] — no `CoordinatorInterface` callback writes
 * impressions yet. The write side lands with the sponsored pipeline (Phase 2E).
 */
export function getImpressionTimestamps(capKey: string): number[] {
  const all = readJson<Record<string, number[]>>(STORAGE_KEY, {})
  return all[capKey] ?? []
}
