import { fetchJson } from "@common/utilities/fetch"
import { createBufferedLogger } from "@common/utilities/logger"
import { isJsModulePath } from "@common/utilities/values"
import { RENDERER_CACHE_NAME, REMOTE_PREFIX, BUNDLED_PREFIX } from "./constants"

import type { AppRenderManifest, BaselineRenderer } from "@common/types"

const logger = createBufferedLogger({
  prefix: "Coordinator: Renderer Cache",
  groupLabel: "HNT Renderer Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fdd303",
  },
})

/**
 * getCachedRenderer
 * ---
 * So this will just grab the cached renderer OR return null
 */
async function getCachedRenderer(): Promise<
  BaselineRenderer | null | undefined
> {
  try {
    if ("caches" in window) {
      const cache = await caches.open(RENDERER_CACHE_NAME)
      const manifestResponse = await cache.match(`${REMOTE_PREFIX}/manifest.json`) //prettier-ignore

      // No manifest... no renderer ... no ticket!
      if (!manifestResponse) return null
      const manifest = (await manifestResponse.json()) as AppRenderManifest

      // Validate manifest internal consistency
      if (!manifest.file.includes(manifest.hash)) {
        logger.warn(
          "cache: manifest internal inconsistency; file doesn't include hash",
          { file: manifest.file, hash: manifest.hash },
        )
        await cache.delete(`${REMOTE_PREFIX}/manifest.json`)
        return null
      }

      // Let's css this
      const cssUrl = manifest.cssFile ? `${REMOTE_PREFIX}/${manifest.cssFile}` : null // prettier-ignore
      const cssResponse = cssUrl ? await cache.match(cssUrl) : null

      if (manifest.cssFile && !cssResponse) {
        logger.warn("cache: remote CSS missing; falling back to bundled", manifest.cssFile) //prettier-ignore
        return null
      }

      // Let's make sure the `file` is proper shaped
      if (!isJsModulePath(manifest.file)) {
        logger.warn("cache: remote manifest.file is not JS; falling back to bundled", manifest.file) //prettier-ignore
        return null
      }

      // Let's pull the actual bundle out of the cache
      const jsUrl = `${REMOTE_PREFIX}/${manifest.file}`
      const jsResponse = await cache.match(jsUrl)

      // If it isn't there, we will just fall back to bundled
      if (!jsResponse) {
        logger.warn("cache: remote JS missing; falling back to bundled", manifest.file ) //prettier-ignore
        return null
      }

      // If we have reached here, all is well
      logger.info("renderer: cached ✅")
      return { manifest, jsUrl }
    }
  } catch (e) {
    logger.warn("cache: manifest parse failed; falling back to bundled", e) //prettier-ignore
    return null
  }
}

/**
 * getBundledRenderer
 * ---
 * This will grab the renderer that we ship with the coordinator. This is what
 * we render when the coordinator is fresher than the remote version OR when the
 * remote version is out of bounds somehow.  Safety zone ...
 */
async function getBundledRenderer(): Promise<BaselineRenderer> {
  const manifest = await fetchJson<AppRenderManifest>(
    `${BUNDLED_PREFIX}/manifest.json`,
    "reload",
  )

  const jsUrl = `${BUNDLED_PREFIX}/${manifest.file}`
  logger.info("renderer: bundled ✅")

  return { manifest, jsUrl }
}

/**
 * Proactive cache validation on boot (optional).
 * Checks if the cached manifest references a JS file that actually exists in the cache.
 * If not, clears the orphaned manifest entry to prevent import failures.
 *
 * The cached renderer comes from remote (/remote/poc/) which is the primary source.
 * Bundled (/static/poc/) is the fallback when remote is unavailable or cache is invalid.
 */
export async function validateRendererCache(): Promise<void> {
  if (!("caches" in window)) return

  const cache = await caches.open(RENDERER_CACHE_NAME)
  const manifestResponse = await cache.match(`${REMOTE_PREFIX}/manifest.json`)

  if (!manifestResponse) {
    return // No cache, nothing to validate
  }

  const manifest = (await manifestResponse.json()) as AppRenderManifest
  const jsResponse = await cache.match(`${REMOTE_PREFIX}/${manifest.file}`)

  if (!jsResponse) {
    logger.warn("cache: manifest references missing JS file; clearing cache", {
      file: manifest.file,
    })
    await cache.delete(`${REMOTE_PREFIX}/manifest.json`)
  }
}

/**
 * Resolves the baseline renderer for this session without mounting it.
 *
 * Behavior:
 * - Prefer cached manifest + cached JS from REMOTE_PREFIX.
 * - If cache is missing/invalid, fall back to bundled-in manifest at BUNDLED_PREFIX.
 *
 * This is intentionally mount-free so main.ts can decide when to render,
 * possibly after coordinating data.
 */
export async function resolveRenderers(): Promise<{
  cached?: BaselineRenderer | null
  bundled: BaselineRenderer
}> {
  const cached = await getCachedRenderer()
  const bundled = await getBundledRenderer()

  // Cached renderer comes from remote (primary source)
  // Bundled renderer is the fallback (ships with coordinator)
  // Trust cached if it exists and passed self-validation
  // SWR background update will fetch remote and cache for next load

  if (cached) {
    logger.info("using cached renderer from remote", {
      hash: cached.manifest.hash,
    })
  } else {
    logger.info("no cached renderer; using bundled fallback", {
      hash: bundled.manifest.hash,
    })
  }

  return { cached, bundled }
}

/**
 * Fetches the latest remote manifest from the API.
 *
 * Behavior:
 * - Issues a no-store fetch to REMOTE_PREFIX/manifest.json with a timestamp
 *   query parameter to avoid intermediary caching during development.
 * - Returns null on any network or HTTP failure.
 *
 * This function does not read or write cache and is safe to call on intervals
 * for SWR-style polling.
 */
export async function fetchRemoteManifest(): Promise<AppRenderManifest | null> {
  try {
    logger.info("getting remote manifest")
    const manifest = await fetchJson<AppRenderManifest>(
      `${REMOTE_PREFIX}/manifest.json?ts=${Date.now()}`,
      "no-store",
    )
    logger.info("manifest returned:", manifest)
    return manifest
  } catch (e) {
    logger.warn("remote manifest fetch failed", e)
    return null
  }
}

/**
 * Writes a renderer manifest and its JS bundle into the single renderer cache.
 *
 * Behavior:
 * - Opens the renderer cache.
 * - Fetches the JS bundle from the network (no-store) and stores it under
 *   REMOTE_PREFIX/manifest.file.
 * - Clears existing entries so only one renderer snapshot is kept.
 * - Stores the manifest at REMOTE_PREFIX/manifest.json.
 *
 * This is only called after the remote renderer bundle has been validated.
 * The currently mounted renderer instance is not touched.
 */
export async function cacheRenderer(
  manifest: AppRenderManifest,
): Promise<void> {
  if (!("caches" in window)) return
  if (!isJsModulePath(manifest.file)) return

  const jsPath = `${REMOTE_PREFIX}/${manifest.file}`
  const cssPath = manifest.cssFile ? `${REMOTE_PREFIX}/${manifest.cssFile}` : null // prettier-ignore

  // First, prove that the new bundle is actually fetchable.
  // If this throws or returns non-OK, we leave the existing cache untouched.
  const jsResponse = await fetch(jsPath, { cache: "no-store" })
  if (!jsResponse.ok) throw new Error(`cache: JS fetch failed ${jsPath} -> ${jsResponse.status}`) // prettier-ignore

  // Now we need to cache the CSS as well
  let cssResponse: Response | null = null
  if (cssPath) {
    cssResponse = await fetch(cssPath, { cache: "no-store" })
    if (!cssResponse.ok) throw new Error(`cache: CSS fetch failed ${cssPath} -> ${cssResponse.status}`) // prettier-ignore
  }

  const cache = await caches.open(RENDERER_CACHE_NAME)

  // Only now that we have a good JS response do we replace the old snapshot.
  const existing = await cache.keys()
  await Promise.all(existing.map((req) => cache.delete(req)))

  const manifestUrl = `${REMOTE_PREFIX}/manifest.json`
  await cache.put(
    manifestUrl,
    new Response(JSON.stringify(manifest), {
      headers: { "Content-Type": "application/json" },
    }),
  )

  await cache.put(jsPath, jsResponse.clone())
  if (cssPath && cssResponse) await cache.put(cssPath, cssResponse.clone())

  logger.log("cache: stored renderer", {
    hash: manifest.hash,
    file: manifest.file,
    cssFile: manifest.cssFile,
  })
}
