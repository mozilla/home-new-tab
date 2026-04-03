import { createBufferedLogger } from "@common/utilities/logger"
import { DATA_SCHEMA_VERSION } from "../constants"
import { getSectionPrefs } from "../interface/section-personalization"

import type { DiscoverFeed } from "@common/types"

const DISCOVERY_CACHE_NAME = "discovery-data"
const DISCOVERY_TTL_MS = 1_800_000 // 30 minutes
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
