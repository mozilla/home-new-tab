export const REMOTE_PREFIX = "/remote/poc"
export const REMOTE_DATA_URL = "/api/mock"
export const ROOT_ID = "root"
export const BAKED_PREFIX = "/static/poc"
export const RENDERER_CACHE_NAME = "renderer"

// Shared data schema version for coordinated payloads.
// Renderer builds and coordinator must agree on this at release time.
export const DATA_SCHEMA_VERSION = "1.0.0" as const
export const DATA_SCHEMA_MAJOR = 1

/**
 * Data cache is separate from the renderer cache. Renderer cache holds code,
 * data cache holds coordinated payloads. They move on different timescales.
 */
export const DATA_CACHE_NAME = "renderer-data"

/**
 * Time to live for considering coordinated data a candidate for update.
 * Old data is still used for the current load; it only controls whether
 * a background refresh should run to improve the cache for the next load.
 */
export const DATA_TTL_MS = 60_000 // One minute for dev

/**
 * Time to stale for considering coordinated data unfit for use, so a blocking
 * request should be made.
 */
export const DATA_STALE_MS = 1_800_000 // Half an hour for dev
