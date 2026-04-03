import { createBufferedLogger } from "@common/utilities/logger"
import { DATA_SCHEMA_VERSION } from "../constants"
import { getContextId } from "../interface/context-id"
import { getSpocBlocks } from "../interface/spoc-block-list"

import type { RawSponsoredData } from "@common/types"

const SPOCS_CACHE_NAME = "spocs-data"
const SPOCS_TTL_MS = 1_800_000 // 30 minutes
const SPOCS_ENDPOINT = "/api/spocs"

const logger = createBufferedLogger({
  prefix: "Coordinator: Spocs",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fd0391",
  },
})

function spocsCacheKey(): string {
  return `/data/spocs?schema=${encodeURIComponent(DATA_SCHEMA_VERSION)}`
}

function isFresh(updatedAt: string): boolean {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < SPOCS_TTL_MS
}

async function getCachedSpocs(): Promise<{
  data: RawSponsoredData
  updatedAt: string
} | null> {
  if (!("caches" in window)) return null
  const cache = await caches.open(SPOCS_CACHE_NAME)
  const res = await cache.match(spocsCacheKey())
  if (!res) return null
  return (await res.clone().json()) as { data: RawSponsoredData; updatedAt: string }
}

async function putCachedSpocs(data: RawSponsoredData): Promise<void> {
  if (!("caches" in window)) return
  const cache = await caches.open(SPOCS_CACHE_NAME)
  const entry = { data, updatedAt: new Date().toISOString() }
  await cache.put(
    spocsCacheKey(),
    new Response(JSON.stringify(entry), {
      headers: { "Content-Type": "application/json" },
    }),
  )
}

/**
 * Fetches sponsored content placements for the current session.
 *
 * Serves from the source-level cache when fresh (30-minute TTL).
 * MARS is a trusted surface — the response is passed through as-is.
 * Returns null on network failure.
 */
export async function fetchSpocs(): Promise<RawSponsoredData | null> {
  const cached = await getCachedSpocs()
  if (cached && isFresh(cached.updatedAt)) {
    logger.info("spocs: cache hit", cached.data)
    return cached.data
  }

  logger.info("spocs: fetching fresh data")

  const contextId = getContextId()
  const blocks = getSpocBlocks()

  let raw: unknown
  try {
    const res = await fetch(`${SPOCS_ENDPOINT}?ts=${Date.now()}`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextId, blocks }),
    })
    if (!res.ok) {
      logger.warn("spocs: fetch failed", res.status)
      return null
    }
    raw = await res.json()
  } catch (e) {
    logger.warn("spocs: fetch threw", e)
    return null
  }

  const data = raw as RawSponsoredData
  await putCachedSpocs(data)
  logger.info("spocs: fetched and cached", data)
  return data
}
