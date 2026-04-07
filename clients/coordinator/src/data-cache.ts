import { createBufferedLogger } from "@common/utilities/logger"
import { DATA_SCHEMA_VERSION, DATA_CACHE_NAME, DATA_TTL_MS } from "./constants"
import {
  fetchDiscovery,
  readCachedDiscovery,
  clearCachedDiscovery,
  expireCachedDiscovery,
} from "./data-sources/discovery"
import {
  fetchSpocs,
  readCachedSpocs,
  clearCachedSpocs,
  expireCachedSpocs,
} from "./data-sources/spocs"
import { fetchTopSiteDefaults } from "./data-sources/top-sites"
import { fetchWallpapers } from "./data-sources/wallpapers"
import {
  fetchWeather,
  readCachedWeather,
  clearCachedWeather,
  expireCachedWeather,
} from "./data-sources/weather"
import { getFrecentSites } from "./interface/frecent-sites"
import { getMessageDefinitions } from "./interface/message-definitions"
import { resolveMessages } from "./interface/message-state"
import { getPinnedSites } from "./interface/pinned-sites"

import type { CoordinatedData, CoordinatedPayload } from "@common/types"
import type {
  DataSourceStatus,
  DataSourceStatuses,
  DataSourceTimestamps,
} from "@common/types"

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
  cachedAt: DataSourceTimestamps
  pendingKeys: Array<keyof CoordinatedData>
  staleKeys: Array<keyof CoordinatedData>
}> {
  const [
    topSiteDefaults,
    wallpapers,
    cachedWeather,
    cachedDiscovery,
    cachedSpocs,
  ] = await Promise.all([
    fetchTopSiteDefaults(),
    fetchWallpapers(),
    readCachedWeather(),
    readCachedDiscovery(),
    readCachedSpocs(),
  ])

  const pinned = getPinnedSites()
  const frecent = getFrecentSites()
  const messages = resolveMessages(getMessageDefinitions())

  const data: Partial<CoordinatedData> = {
    topSites: {
      ...(topSiteDefaults ? { defaults: topSiteDefaults } : {}),
      ...(pinned.length ? { pinned } : {}),
      ...(frecent.length ? { frecent } : {}),
    },
    ...(wallpapers ? { wallpapers } : {}),
    ...(messages.length ? { messages } : {}),
    ...(cachedWeather ? { weather: cachedWeather.data } : {}),
    ...(cachedDiscovery ? { discovery: cachedDiscovery.data } : {}),
    ...(cachedSpocs ? { sponsored: cachedSpocs.data } : {}),
  }

  const pendingKeys: Array<keyof CoordinatedData> = []
  const staleKeys: Array<keyof CoordinatedData> = []

  // fresh — ready  (no fetch needed this session)
  // stale — stale  (data present, background cache-warm only — no update())
  // null — pending (no data, fetch needed — update() will deliver it)
  const statuses: DataSourceStatuses = {
    topSites: topSiteDefaults !== null ? "ready" : "failed",
    wallpapers: wallpapers !== null ? "ready" : "failed",
    messages: "ready",
    weather: cachedWeather?.fresh
      ? "ready"
      : cachedWeather
        ? "stale"
        : "pending",
    discovery: cachedDiscovery?.fresh
      ? "ready"
      : cachedDiscovery
        ? "stale"
        : "pending",
    sponsored: cachedSpocs?.fresh ? "ready" : cachedSpocs ? "stale" : "pending",
  }

  if (!cachedWeather) pendingKeys.push("weather")
  else if (!cachedWeather.fresh) staleKeys.push("weather")

  if (!cachedDiscovery) pendingKeys.push("discovery")
  else if (!cachedDiscovery.fresh) staleKeys.push("discovery")

  if (!cachedSpocs) pendingKeys.push("sponsored")
  else if (!cachedSpocs.fresh) staleKeys.push("sponsored")

  const cachedAt: DataSourceTimestamps = {
    ...(cachedWeather ? { weather: cachedWeather.updatedAt } : {}),
    ...(cachedDiscovery ? { discovery: cachedDiscovery.updatedAt } : {}),
    ...(cachedSpocs ? { sponsored: cachedSpocs.updatedAt } : {}),
  }

  logger.info("blocking sources assembled", {
    data,
    statuses,
    cachedAt,
    pendingKeys,
    staleKeys,
  })
  return { data, statuses, cachedAt, pendingKeys, staleKeys }
}

/**
 * Fires background fetches for sources that were stale at mount time.
 *
 * Called once per session after mount. Stale sources already have data showing —
 * these fetches write to per-source cache for the next load only. No update()
 * is called; the live renderer is not disturbed.
 */
export function warmStaleCaches(staleKeys: Array<keyof CoordinatedData>): void {
  if (staleKeys.includes("weather")) void fetchWeather().catch(() => {})
  if (staleKeys.includes("discovery")) void fetchDiscovery().catch(() => {})
  if (staleKeys.includes("sponsored")) void fetchSpocs().catch(() => {})
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
        deliver(
          "weather",
          weather ? { weather } : null,
          weather ? "ready" : "failed",
        )
      })
      .catch(() => deliver("weather", null, "failed"))
  }

  if (pendingKeys.includes("discovery")) {
    fetchDiscovery()
      .then((discovery) => {
        deliver(
          "discovery",
          discovery ? { discovery } : null,
          discovery ? "ready" : "failed",
        )
      })
      .catch(() => deliver("discovery", null, "failed"))
  }

  if (pendingKeys.includes("sponsored")) {
    fetchSpocs()
      .then((spocs) => {
        deliver(
          "sponsored",
          spocs ? { sponsored: spocs } : null,
          spocs ? "ready" : "failed",
        )
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

/**
 * Clears the cache for a single deferred source by key.
 * Used by the dev window.hntClearSource tool — backdates the source timestamp
 * so the next load treats it as stale (↻). Data is preserved; background warm
 * fires but no update() is pushed this session.
 */
export async function clearSourceCache(
  key: "weather" | "discovery" | "sponsored",
): Promise<void> {
  if (key === "weather") await clearCachedWeather()
  else if (key === "discovery") await clearCachedDiscovery()
  else if (key === "sponsored") await clearCachedSpocs()
}

/**
 * Expires the cache for a single deferred source by key.
 * Deletes the cache entry entirely so readCachedX() returns null.
 * Used by the dev window.hntExpireSource tool — simulates max-age expiry so
 * the next load treats the source as pending and fires the deferred pipeline.
 */
export async function expireSourceCache(
  key: "weather" | "discovery" | "sponsored",
): Promise<void> {
  if (key === "weather") await expireCachedWeather()
  else if (key === "discovery") await expireCachedDiscovery()
  else if (key === "sponsored") await expireCachedSpocs()
}

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
