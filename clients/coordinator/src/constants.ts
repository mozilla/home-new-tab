export const REMOTE_PREFIX = "/remote/poc"
export const ROOT_ID = "root"
export const BUNDLED_PREFIX = "/static/poc"
export const RENDERER_CACHE_NAME = "renderer"

/**
 * Data cache is separate from the renderer cache. Renderer cache holds code,
 * data cache holds coordinated payloads. They move on different timescales.
 */
export const DATA_CACHE_NAME = "renderer-data"

/**
 * Schema cache holds the renderer's data-schema.json artifact, keyed by
 * renderer hash. One fetch per new renderer version; instant reads after.
 */
export const SCHEMA_CACHE_NAME = "renderer-schema"

/**
 * Time to live for considering coordinated data a candidate for update.
 * Old data is still used for the current load; it only controls whether
 * a background refresh should run to improve the cache for the next load.
 */
export const DATA_TTL_MS = 60_000 // One minute for dev
