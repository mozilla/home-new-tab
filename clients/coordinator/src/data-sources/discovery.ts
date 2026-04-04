import { createBufferedLogger } from "@common/utilities/logger"
import { DATA_SCHEMA_VERSION } from "../constants"
import { getSectionPrefs } from "../interface/section-personalization"

import type { DiscoverFeed } from "@common/types"

const DISCOVERY_CACHE_NAME = "discovery-data"
const DISCOVERY_TTL_MS = 1_800_000 // 30 minutes — trigger background refresh
const DISCOVERY_MAX_AGE_MS = 86_400_000 // 24 hours — drop rather than show stale
const DISCOVERY_ENDPOINT = "/api/discover"

const logger = createBufferedLogger({
  prefix: "Coordinator: Discovery",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fd0391",
  },
})

function discoveryCacheKey(): string {
  return `/data/discovery?schema=${encodeURIComponent(DATA_SCHEMA_VERSION)}`
}

function isFresh(updatedAt: string): boolean {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < DISCOVERY_TTL_MS
}

function isWithinMaxAge(updatedAt: string): boolean {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < DISCOVERY_MAX_AGE_MS
}

async function getCachedDiscovery(): Promise<{
  data: DiscoverFeed
  updatedAt: string
} | null> {
  if (!("caches" in window)) return null
  const cache = await caches.open(DISCOVERY_CACHE_NAME)
  const res = await cache.match(discoveryCacheKey())
  if (!res) return null
  return (await res.clone().json()) as { data: DiscoverFeed; updatedAt: string }
}

async function putCachedDiscovery(data: DiscoverFeed): Promise<void> {
  if (!("caches" in window)) return
  const cache = await caches.open(DISCOVERY_CACHE_NAME)
  const entry = { data, updatedAt: new Date().toISOString() }
  await cache.put(
    discoveryCacheKey(),
    new Response(JSON.stringify(entry), {
      headers: { "Content-Type": "application/json" },
    }),
  )
}

/**
 * Fetches discovery feed data for the current session.
 *
 * Serves from the source-level cache when fresh (30-minute TTL).
 * Merino is a trusted surface — the response is passed through as-is.
 * Returns null on network failure.
 */

/**
 * Marks the discovery cache entry as stale by backdating its timestamp.
 * The data is preserved so the next load shows ↻ (stale) rather than ⏳ (pending),
 * and the deferred pipeline fires a fresh fetch to replace it.
 */
export async function clearCachedDiscovery(): Promise<void> {
  const cached = await getCachedDiscovery()
  if (!cached) return
  if (!("caches" in window)) return
  const cache = await caches.open(DISCOVERY_CACHE_NAME)
  const stale = { data: cached.data, updatedAt: new Date(Date.now() - DISCOVERY_TTL_MS - 1).toISOString() }
  await cache.put(
    discoveryCacheKey(),
    new Response(JSON.stringify(stale), {
      headers: { "Content-Type": "application/json" },
    }),
  )
}

/**
 * Expires the discovery cache entry by deleting the underlying Cache API entry.
 * After this call, readCachedDiscovery() returns null — the next load treats
 * discovery as a cold-start pending source and delivers data via update().
 */
export async function expireCachedDiscovery(): Promise<void> {
  if (!("caches" in window)) return
  const cache = await caches.open(DISCOVERY_CACHE_NAME)
  await cache.delete(discoveryCacheKey())
}

/**
 * Returns the cached discovery entry and whether it is still fresh.
 * Returns null if no cache entry exists at all.
 * No network call — used by the coordinator to assess warmth before mount.
 */
export async function readCachedDiscovery(): Promise<{ data: DiscoverFeed; fresh: boolean; updatedAt: string } | null> {
  const cached = await getCachedDiscovery()
  if (!cached) return null
  if (!isWithinMaxAge(cached.updatedAt)) return null
  return { data: cached.data, fresh: isFresh(cached.updatedAt), updatedAt: cached.updatedAt }
}

export async function fetchDiscovery(): Promise<DiscoverFeed | null> {
  const cached = await getCachedDiscovery()
  if (cached && isFresh(cached.updatedAt)) {
    logger.info("discovery: cache hit", cached.data)
    return cached.data
  }

  logger.info("discovery: fetching fresh data")

  const { followed, blocked } = getSectionPrefs()
  const params = new URLSearchParams({ ts: String(Date.now()) })
  if (followed.length) params.set("followed", followed.join(","))
  if (blocked.length) params.set("blocked", blocked.join(","))

  let raw: unknown
  try {
    const res = await fetch(`${DISCOVERY_ENDPOINT}?${params}`, {
      cache: "no-store",
    })
    if (!res.ok) {
      logger.warn("discovery: fetch failed", res.status)
      return null
    }
    raw = await res.json()
  } catch (e) {
    logger.warn("discovery: fetch threw", e)
    return null
  }

  const data = raw as DiscoverFeed
  await putCachedDiscovery(data)
  logger.info("discovery: fetched and cached", data)
  return data
}
