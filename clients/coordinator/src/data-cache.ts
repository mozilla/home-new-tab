import { createBufferedLogger } from "@common/utilities/logger"
import { DATA_SCHEMA_VERSION, DATA_CACHE_NAME, DATA_TTL_MS, SCHEMA_CACHE_NAME } from "./constants"
import * as merinoTransport from "./transports/merino"
import * as rsTransport from "./transports/rs"

import type { BrowserCoreAdapter, CoordinatedData, CoordinatedPayload } from "@common/types"
import type {
  DataSourceStatus,
  DataSourceStatuses,
  DataSourceTimestamps,
} from "@common/types"
import type {
  CoreDescriptor,
  MerinoDescriptor,
  RSDescriptor,
  SourceDescriptor,
} from "./data-schema"

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
 * Returns the renderer's data-schema.json from cache if the renderer hash
 * matches, otherwise fetches from the given URL, caches the result, and
 * returns it. Falls back to an empty schema on any fetch failure.
 */
export async function getOrFetchSchema(
  url: string,
  rendererHash: string,
): Promise<SourceDescriptor[]> {
  const key = `/schema?hash=${rendererHash}`
  const cached = await getCachedJson<SourceDescriptor[]>(SCHEMA_CACHE_NAME, key)
  if (cached) return cached
  try {
    const res = await fetch(url)
    if (!res.ok) {
      logger.warn("schema: fetch failed", res.status, url)
      return []
    }
    const schema = (await res.json()) as SourceDescriptor[]
    await putCachedJson(SCHEMA_CACHE_NAME, key, schema)
    return schema
  } catch (e) {
    logger.warn("schema: fetch threw", e)
    return []
  }
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
 * Fetches a single blocking descriptor and returns the result.
 * RS and core descriptors are blocking. Merino descriptors are never blocking.
 */
async function fetchBlockingDescriptor(
  descriptor: RSDescriptor | CoreDescriptor,
  browserCore: BrowserCoreAdapter,
): Promise<Partial<CoordinatedData> | null> {
  if (descriptor.transport === "rs") {
    return rsTransport.fetch(descriptor)
  }

  // core transport — dispatch to BrowserCoreAdapter by schema key, no domain knowledge here
  const data: Partial<CoordinatedData> = {}
  for (const key of descriptor.keys) {
    const result = await browserCore.getData(key)
    if (result != null) {
      ;(data as Record<string, unknown>)[key] = result
    }
  }
  return Object.keys(data).length > 0 ? data : null
}

/**
 * Returns the failure keys for a blocking descriptor — used when fetch returns null.
 */
function blockingFailureKeys(
  descriptor: RSDescriptor | CoreDescriptor,
): Array<keyof CoordinatedData> {
  if (descriptor.transport === "rs") return [descriptor.key]
  return descriptor.keys
}

/**
 * Assembles all available data before mount.
 *
 * Blocking sources (RS, core bridge) are fetched unconditionally — they are
 * local-first and fast. Deferred sources (merino) are checked against their
 * per-source cache. If fresh, they fold into the initial payload as "ready".
 * If stale, they are marked for background warming. If absent, they are
 * marked "pending" for delivery via deliverDeferredSources.
 *
 * Which sources are blocking and which are deferred is declared in the schema,
 * not in this function.
 */
export async function assembleBlockingData(
  schema: SourceDescriptor[],
  browserCore: BrowserCoreAdapter,
): Promise<{
  data: Partial<CoordinatedData>
  statuses: DataSourceStatuses
  cachedAt: DataSourceTimestamps
  pendingKeys: Array<keyof CoordinatedData>
  staleKeys: Array<keyof CoordinatedData>
}> {
  const blockingDescriptors = schema.filter(
    (d): d is RSDescriptor | CoreDescriptor => d.blocking,
  )
  const merinoDescriptors = schema.filter(
    (d): d is MerinoDescriptor => !d.blocking,
  )

  const [blockingResults, cachedResults] = await Promise.all([
    Promise.all(
      blockingDescriptors.map((d) => fetchBlockingDescriptor(d, browserCore).catch(() => null)),
    ),
    Promise.all(
      merinoDescriptors.map((d) => merinoTransport.readCached(d).catch(() => null)),
    ),
  ])

  const data: Partial<CoordinatedData> = {}
  const statuses: DataSourceStatuses = {}
  const cachedAt: DataSourceTimestamps = {}
  const pendingKeys: Array<keyof CoordinatedData> = []
  const staleKeys: Array<keyof CoordinatedData> = []

  for (let i = 0; i < blockingDescriptors.length; i++) {
    const descriptor = blockingDescriptors[i]
    const result = blockingResults[i]
    if (result) {
      Object.assign(data, result)
      for (const k of Object.keys(result) as Array<keyof CoordinatedData>) {
        statuses[k] = "ready"
      }
    } else {
      for (const k of blockingFailureKeys(descriptor)) {
        statuses[k] = "failed"
      }
    }
  }

  for (let i = 0; i < merinoDescriptors.length; i++) {
    const descriptor = merinoDescriptors[i]
    const cached = cachedResults[i]
    if (cached) {
      Object.assign(data, cached.data)
      cachedAt[descriptor.key] = cached.updatedAt
      statuses[descriptor.key] = cached.fresh ? "ready" : "stale"
      if (!cached.fresh) staleKeys.push(descriptor.key)
    } else {
      statuses[descriptor.key] = "pending"
      pendingKeys.push(descriptor.key)
    }
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
 * Called once per session after mount. Stale sources already have data
 * showing — these fetches write to per-source cache for the next load only.
 * No update() is called; the live renderer is not disturbed.
 */
export function warmStaleCaches(
  schema: SourceDescriptor[],
  staleKeys: Array<keyof CoordinatedData>,
): void {
  for (const descriptor of schema) {
    if (descriptor.blocking) continue
    if (!staleKeys.includes(descriptor.key)) continue
    void merinoTransport.fetch(descriptor).catch(() => {})
  }
}

/**
 * Fires network fetches for sources that were not warm at mount time.
 *
 * Called once per session, immediately after mount. Only sources listed in
 * pendingKeys are fetched. Each source calls deliver() independently as it
 * resolves.
 *
 * This is the initial delivery path only. Background SWR uses
 * refreshCacheForNextSession() and does not call deliver().
 */
export function deliverDeferredSources(
  schema: SourceDescriptor[],
  pendingKeys: Array<keyof CoordinatedData>,
  deliver: (
    key: keyof CoordinatedData,
    data: Partial<CoordinatedData> | null,
    status: DataSourceStatus,
  ) => void,
): void {
  for (const descriptor of schema) {
    if (descriptor.blocking) continue
    if (!pendingKeys.includes(descriptor.key)) continue

    merinoTransport
      .fetch(descriptor)
      .then((result) => deliver(descriptor.key, result, result ? "ready" : "failed"))
      .catch(() => deliver(descriptor.key, null, "failed"))
  }
}

/**
 * Clears the cache for a single merino source by key.
 * Used by the dev window.hntClearSource tool — backdates the source timestamp
 * so the next load treats it as stale (↻). Data is preserved; background warm
 * fires but no update() is pushed this session.
 */
export async function clearSourceCache(
  schema: SourceDescriptor[],
  key: "weather" | "discovery" | "sponsored",
): Promise<void> {
  const descriptor = schema.find(
    (d): d is MerinoDescriptor => !d.blocking && d.key === key,
  )
  if (descriptor) await merinoTransport.clear(descriptor)
}

/**
 * Expires the cache for a single merino source by key.
 * Deletes the cache entry entirely so readCached returns null.
 * Used by the dev window.hntExpireSource tool — simulates max-age expiry so
 * the next load treats the source as pending and fires the deferred pipeline.
 */
export async function expireSourceCache(
  schema: SourceDescriptor[],
  key: "weather" | "discovery" | "sponsored",
): Promise<void> {
  const descriptor = schema.find(
    (d): d is MerinoDescriptor => !d.blocking && d.key === key,
  )
  if (descriptor) await merinoTransport.expire(descriptor)
}

/**
 * Refreshes all sources and writes the result to cache for the next session.
 *
 * Called from the SWR background path when the current payload is old enough
 * to warrant a refresh. Does not call update() or push to the live renderer —
 * the user's current session is not disturbed.
 */
export async function refreshCacheForNextSession(
  schema: SourceDescriptor[],
  browserCore: BrowserCoreAdapter,
): Promise<void> {
  const key = coordinatedKey()

  try {
    const results = await Promise.all(
      schema.map(async (descriptor) => {
        if (!descriptor.blocking) {
          return merinoTransport.fetch(descriptor).catch(() => null)
        }
        if (descriptor.transport === "rs") {
          return rsTransport.fetch(descriptor).catch(() => null)
        }
        // core transport
        return fetchBlockingDescriptor(descriptor, browserCore).catch(() => null)
      }),
    )

    const data: Partial<CoordinatedData> = {}
    for (const result of results) {
      if (result) Object.assign(data, result)
    }

    const payload: CoordinatedPayload = {
      schemaVersion: DATA_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data: data as CoordinatedData,
    }

    await putCachedJson<CoordinatedPayload>(DATA_CACHE_NAME, key, payload)
    logger.info("cache refreshed for next session", payload)
  } catch (e) {
    logger.warn("cache refresh threw", e)
  }
}
