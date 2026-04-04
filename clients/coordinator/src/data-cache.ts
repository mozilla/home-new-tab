import { createBufferedLogger } from "@common/utilities/logger"
import {
  DATA_SCHEMA_VERSION,
  DATA_CACHE_NAME,
  DATA_TTL_MS,
  DATA_STALE_MS,
} from "./constants"
import { fetchDiscovery, readCachedDiscovery } from "./data-sources/discovery"
import { fetchSpocs, readCachedSpocs } from "./data-sources/spocs"
import { fetchTopSiteDefaults } from "./data-sources/top-sites"
import { fetchWallpapers } from "./data-sources/wallpapers"
import { fetchWeather, readCachedWeather } from "./data-sources/weather"
import { getFrecentSites } from "./interface/frecent-sites"
import { getPinnedSites } from "./interface/pinned-sites"

import type { CoordinatedData, CoordinatedPayload } from "@common/types"
import type { DataSourceStatus, DataSourceStatuses } from "@common/types"

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
 * Staleness means we should make a blocking data request. This would be used in
 * a scenario where the cached data payload was too far out of date.
 */
export function isDataStale(payload: CoordinatedPayload): boolean {
  const updatedAt = Date.parse(payload.updatedAt)
  if (Number.isNaN(updatedAt)) return true
  const ageMs = Date.now() - updatedAt
  return ageMs > DATA_STALE_MS
}

/**
 * Returns true if a coordinated payload is old enough that a background
 * cache refresh should fire for the next session.
 */
export function shouldDataUpdate(payload: CoordinatedPayload): boolean {
  const updatedAt = Date.parse(payload.updatedAt)
  if (Number.isNaN(updatedAt)) return true
  const ageMs = Date.now() - updatedAt
  return ageMs > DATA_TTL_MS
}

/**
 * Reads the cached coordinated data payload, if present.
 */
export async function getDataPayload(): Promise<CoordinatedPayload | null> {
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
 * Assembles all available data before mount.
 *
 * Always-blocking sources (top sites, pinned links, frecent stubs, wallpapers)
 * are fetched unconditionally — they are local-first and fast.
 *
 * Network-backed deferred sources (weather, discovery, spocs) are checked
 * against their per-source cache. If fresh, they are included immediately as
 * "ready" — no update() cycle needed. If cold or missing, they are marked
 * "pending" and returned in pendingKeys for delivery via deliverDeferredSources.
 */
export async function assembleBlockingData(): Promise<{
  data: Partial<CoordinatedData>
  statuses: DataSourceStatuses
  pendingKeys: Array<keyof CoordinatedData>
}> {
  const [topSiteDefaults, wallpapers, cachedWeather, cachedDiscovery, cachedSpocs] =
    await Promise.all([
      fetchTopSiteDefaults(),
      fetchWallpapers(),
      readCachedWeather(),
      readCachedDiscovery(),
      readCachedSpocs(),
    ])

  const pinned = getPinnedSites()
  const frecent = getFrecentSites()

  const data: Partial<CoordinatedData> = {
    topSites: {
      ...(topSiteDefaults ? { defaults: topSiteDefaults } : {}),
      ...(pinned.length ? { pinned } : {}),
      ...(frecent.length ? { frecent } : {}),
    },
    ...(wallpapers ? { wallpapers } : {}),
    ...(cachedWeather ? { weather: cachedWeather } : {}),
    ...(cachedDiscovery ? { discovery: cachedDiscovery } : {}),
    ...(cachedSpocs ? { sponsored: cachedSpocs } : {}),
  }

  const pendingKeys: Array<keyof CoordinatedData> = []

  const statuses: DataSourceStatuses = {
    topSites: topSiteDefaults !== null ? "ready" : "failed",
    wallpapers: wallpapers !== null ? "ready" : "failed",
    weather: cachedWeather !== null ? "ready" : "pending",
    discovery: cachedDiscovery !== null ? "ready" : "pending",
    sponsored: cachedSpocs !== null ? "ready" : "pending",
  }

  if (!cachedWeather) pendingKeys.push("weather")
  if (!cachedDiscovery) pendingKeys.push("discovery")
  if (!cachedSpocs) pendingKeys.push("sponsored")

  logger.info("blocking sources assembled", { data, statuses, pendingKeys })
  return { data, statuses, pendingKeys }
}

/**
 * Fires network fetches for sources that were not warm at mount time.
 *
 * Called once per session, immediately after mount. Only sources listed in
 * pendingKeys are fetched — warm sources were already included in the initial
 * mount payload. Each source calls deliver() independently as it resolves.
 *
 * This is the initial delivery path only. Background SWR uses
 * refreshCacheForNextSession() and does not call deliver().
 */
export function deliverDeferredSources(
  pendingKeys: Array<keyof CoordinatedData>,
  deliver: (
    key: keyof CoordinatedData,
    data: Partial<CoordinatedData> | null,
    status: DataSourceStatus,
  ) => void,
): void {
  if (pendingKeys.includes("weather")) {
    fetchWeather()
      .then((weather) => {
        deliver("weather", weather ? { weather } : null, weather ? "ready" : "failed")
      })
      .catch(() => deliver("weather", null, "failed"))
  }

  if (pendingKeys.includes("discovery")) {
    fetchDiscovery()
      .then((discovery) => {
        deliver("discovery", discovery ? { discovery } : null, discovery ? "ready" : "failed")
      })
      .catch(() => deliver("discovery", null, "failed"))
  }

  if (pendingKeys.includes("sponsored")) {
    fetchSpocs()
      .then((spocs) => {
        deliver("sponsored", spocs ? { sponsored: spocs } : null, spocs ? "ready" : "failed")
      })
      .catch(() => deliver("sponsored", null, "failed"))
  }
}

/**
 * Refreshes all sources and writes the result to cache for the next session.
 *
 * Called from the SWR background path when the current payload is old enough
 * to warrant a refresh. Does not call update() or push to the live renderer —
 * the user's current session is not disrupted. Per-source TTL checks inside
 * each fetchX() govern whether a network call actually fires.
 */
export async function refreshCacheForNextSession(): Promise<void> {
  const key = coordinatedKey()
  try {
    const [weather, discovery, spocs, wallpapers, topSiteDefaults] =
      await Promise.all([
        fetchWeather(),
        fetchDiscovery(),
        fetchSpocs(),
        fetchWallpapers(),
        fetchTopSiteDefaults(),
      ])

    const pinned = getPinnedSites()
    const frecent = getFrecentSites()

    // Only send valid data in payload so we don't clobber existing content
    const data: CoordinatedData = {
      ...(weather ? { weather } : {}),
      ...(discovery ? { discovery } : {}),
      ...(spocs ? { sponsored: spocs } : {}),
      ...(wallpapers ? { wallpapers } : {}),
      topSites: {
        ...(topSiteDefaults ? { defaults: topSiteDefaults } : {}),
        ...(pinned.length ? { pinned } : {}),
        ...(frecent.length ? { frecent } : {}),
      },
    }

    const payload: CoordinatedPayload = {
      schemaVersion: DATA_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data,
    }

    await putCachedJson<CoordinatedPayload>(DATA_CACHE_NAME, key, payload)
    logger.info("cache refreshed for next session", payload)
  } catch (e) {
    logger.warn("cache refresh threw", e)
  }
}
