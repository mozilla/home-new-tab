import { createBufferedLogger } from "@common/utilities/logger"
import {
  DATA_SCHEMA_VERSION,
  DATA_CACHE_NAME,
  DATA_TTL_MS,
  REMOTE_DATA_URL,
  DATA_STALE_MS,
} from "./constants"

import type { CoordinatedData, CoordinatedPayload } from "@common/types"

/**
 * Just some helper functions that will go away once the discovery phase is over
 * but add some flavor to the logging.
 */
export const logger = createBufferedLogger({
  prefix: "Coordinator: Data",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fd0391",
  },
})

/**
 * Builds the cache/network key for the coordinated data endpoint.
 * Schema version is included so different shapes never share the same key.
 */
function coordinatedKey(): string {
  return `/data/coordinated?schema=${encodeURIComponent(DATA_SCHEMA_VERSION)}`
}

/**
 * Lightweight JSON helpers over Cache API.
 */
async function getCachedJson<T>(
  cacheName: string,
  key: string,
): Promise<T | null> {
  if (!("caches" in window)) return null
  const cache = await caches.open(cacheName)
  const res = await cache.match(key)
  if (!res) return null
  return (await res.clone().json()) as T
}

async function putCachedJson<T>(
  cacheName: string,
  key: string,
  value: T,
): Promise<void> {
  if (!("caches" in window)) return
  const cache = await caches.open(cacheName)
  await cache.put(
    key,
    new Response(JSON.stringify(value), {
      headers: { "Content-Type": "application/json" },
    }),
  )
}

/**
 * Returns true if a coordinated payload is considered stale based on DATA_STALE_MS.
 * Staleness means we should make a blocking data request.  This would be used in
 * a scenario where the cached data payload was too far out of date.
 */
export function isDataStale(payload: CoordinatedPayload): boolean {
  const updatedAt = Date.parse(payload.updatedAt)
  if (Number.isNaN(updatedAt)) return true
  const ageMs = Date.now() - updatedAt
  return ageMs > DATA_STALE_MS
}

/**
 * Returns true if a coordinated payload is considered stale based on DATA_TTL_MS.
 * Staleness does not prevent use; it only influences whether a refresh fires.
 */
export function shouldDataUpdate(payload: CoordinatedPayload): boolean {
  const updatedAt = Date.parse(payload.updatedAt)
  if (Number.isNaN(updatedAt)) return true
  const ageMs = Date.now() - updatedAt
  return ageMs > DATA_TTL_MS
}

/**
 * Refreshes coordinated data in the background.
 *
 * Used when cached data exists but is stale; the value for the current page
 * load does not change, only the cache for future loads is updated.
 */
async function refreshDataInBackground(key: string): Promise<void> {
  try {
    const res = await fetch(`${REMOTE_DATA_URL}?ts=${Date.now()}`, {
      cache: "no-store",
    })

    if (!res.ok) {
      logger.warn("background fetch failed", res.status)
      return
    }
    const data = (await res.json()) as CoordinatedData

    const payload: CoordinatedPayload = {
      schemaVersion: DATA_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data,
    }

    await putCachedJson<CoordinatedPayload>(DATA_CACHE_NAME, key, payload)
    logger.info("refreshed data payload for next load", payload)
  } catch (e) {
    logger.warn("background refresh threw", e)
  }
}

/**
 * Reads a cached coordinated payload snapshot, if present.
 *
 * Behavior:
 * - Uses DATA_SCHEMA_VERSION to build the key.
 * - Returns the cached payload if found.
 * - Does not hit the network and does not refresh; this is the fast snapshot
 *   path for the current load.
 */
export async function getDataSnapshot(): Promise<CoordinatedPayload | null> {
  const key = coordinatedKey()
  const cached = await getCachedJson<CoordinatedPayload>(DATA_CACHE_NAME, key)

  if (!cached) {
    logger.info("no cached data payload for session")
    return null
  }

  logger.info("using cached data payload snapshot", cached)
  return cached
}

/**
 * Primes coordinated data for this and future sessions.
 *
 */
export async function refreshDataForNextSession(): Promise<void> {
  const key = coordinatedKey()
  await refreshDataInBackground(key)
}
