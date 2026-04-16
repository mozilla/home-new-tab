import { createBufferedLogger } from "@common/utilities/logger"

import type { CoordinatedData } from "@common/types"
import type { CachedSourceResult, MerinoDescriptor } from "../data-schema"

const logger = createBufferedLogger({
  prefix: "Coordinator: Merino",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fd0391",
  },
})

function cacheKey(entry: MerinoDescriptor): string {
  return `/data/${entry.key}`
}

async function getCachedEntry(
  entry: MerinoDescriptor,
): Promise<{ data: unknown; updatedAt: string } | null> {
  if (!("caches" in window)) return null
  const cache = await caches.open(entry.cacheName)
  const res = await cache.match(cacheKey(entry))
  if (!res) return null
  return (await res.clone().json()) as { data: unknown; updatedAt: string }
}

async function putCachedEntry(
  entry: MerinoDescriptor,
  data: unknown,
): Promise<void> {
  if (!("caches" in window)) return
  const cache = await caches.open(entry.cacheName)
  const record = { data, updatedAt: new Date().toISOString() }
  await cache.put(
    cacheKey(entry),
    new Response(JSON.stringify(record), {
      headers: { "Content-Type": "application/json" },
    }),
  )
}

function isFresh(updatedAt: string, ttlMs: number): boolean {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < ttlMs
}

function isWithinMaxAge(updatedAt: string, maxAgeMs: number): boolean {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < maxAgeMs
}

/**
 * Returns the cached entry if it exists and has not exceeded maxAge.
 * Returns null if no cache entry exists or if the entry is past maxAge (evicts it).
 * The `fresh` flag indicates whether the entry is still within TTL.
 */
export async function readCached(
  entry: MerinoDescriptor,
): Promise<CachedSourceResult | null> {
  const cached = await getCachedEntry(entry)
  if (!cached) return null
  if (!isWithinMaxAge(cached.updatedAt, entry.maxAgeMs)) {
    // Past max-age — evict so the next load treats this as cold.
    void expire(entry)
    return null
  }
  const fresh = isFresh(cached.updatedAt, entry.ttlMs)
  return {
    data: { [entry.key]: cached.data } as Partial<CoordinatedData>,
    fresh,
    updatedAt: cached.updatedAt,
  }
}

/**
 * Fetches the endpoint and writes the result to the per-source cache.
 * No dynamic params — domain-specific context (geo, followed/blocked, etc.)
 * is the browser core's responsibility. Dev API returns mocks regardless.
 * Returns { [key]: data } on success, null on failure.
 */
export async function fetch(
  entry: MerinoDescriptor,
): Promise<Partial<CoordinatedData> | null> {
  logger.info(`${entry.key}: fetching`, { endpoint: entry.endpoint })

  let raw: unknown
  try {
    const res = await globalThis.fetch(entry.endpoint, {
      method: entry.method,
      cache: "no-store",
    })
    if (!res.ok) {
      logger.warn(`${entry.key}: fetch failed`, res.status)
      return null
    }
    raw = await res.json()
  } catch (e) {
    logger.warn(`${entry.key}: fetch threw`, e)
    return null
  }

  await putCachedEntry(entry, raw)
  logger.info(`${entry.key}: fetched and cached`, raw)
  return { [entry.key]: raw } as Partial<CoordinatedData>
}

/**
 * Backdates the cache timestamp to stale (data preserved).
 * On the next load the source appears as ↻ (stale) and the background warm fires.
 */
export async function clear(entry: MerinoDescriptor): Promise<void> {
  const cached = await getCachedEntry(entry)
  if (!cached) return
  if (!("caches" in window)) return
  const cache = await caches.open(entry.cacheName)
  const stale = {
    data: cached.data,
    updatedAt: new Date(Date.now() - entry.ttlMs - 1).toISOString(),
  }
  await cache.put(
    cacheKey(entry),
    new Response(JSON.stringify(stale), {
      headers: { "Content-Type": "application/json" },
    }),
  )
}

/**
 * Deletes the cache entry entirely.
 * On the next load the source is treated as cold (pending/deferred).
 */
export async function expire(entry: MerinoDescriptor): Promise<void> {
  if (!("caches" in window)) return
  const cache = await caches.open(entry.cacheName)
  await cache.delete(cacheKey(entry))
}
