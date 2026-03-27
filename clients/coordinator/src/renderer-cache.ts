import { createBufferedLogger } from "@common/utilities/logger"
import { isJsModulePath } from "@common/utilities/values"
import { ROOT_ID, RENDERER_CACHE_NAME, REMOTE_PREFIX, BAKED_PREFIX } from "./constants" //prettier-ignore

import type { AppRenderManifest, RendererModule, BaselineRenderer, AppProps, RendererInitArgs } from "@common/types" // prettier-ignore

/** NOTE:  We are really just building this coordinator as a proxy for local
 * dev to prove out patterns and get a clear signal on live dev for any SNAFUs
 * that may crop up.  When we decide to expose this to a CDN like environment we
 * will need to add a few things:
 *
 * - We don't want old hashes to surface because we suddenly got switched
 *   to a not yet updated CDN ... only to be move back once it catches up
 * - Given the long lived nature of things, we may want to do more effective unloading
 * - Since we are now loading at the script level, we need to make sure we aren't
 *   clobbering libraries that are relied upon by other aspects of legacy pages.
 */

declare global {
  interface Window {
    AppRenderer?: RendererModule
  }
}

// High level so we can maintain a record without clobbering it
const scriptLoadCache = new Map<string, Promise<void>>()

/**
 * Just some helper functions that will go away once the discovery phase is over
 * but add some flavor to the logging.
 */
export const logger = createBufferedLogger({
  prefix: "Coordinator: Renderer",
  groupLabel: "HNT Renderer Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fdd303",
  },
})

const RENDERER_CSS_ATTR = "data-hnt-renderer-css"

function baseFromModuleUrl(moduleUrl: string) {
  return moduleUrl.replace(/\/[^/]*$/, "")
}

function upsertRendererCssLink(href: string) {
  logger.info("Upserting CSS")
  const head = document.head
  head
    .querySelectorAll(`link[${RENDERER_CSS_ATTR}="1"]`)
    .forEach((n) => n.remove())

  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href
  link.setAttribute(RENDERER_CSS_ATTR, "1")
  link.addEventListener("error", () => logger.error("css error", { href }))

  head.appendChild(link)
}

/**
 * loadScriptOnce
 * ---
 * Dynamically loads a classic <script> (IIFE/UMD-style) bundle exactly once.
 *
 * Responsibilities:
 * - Injects a <script src="..."> into <head>.
 * - Deduplicates by URL using an in-memory cache.
 * - Resolves when the script fires `load`.
 * - Rejects if the script fails to load.
 *
 * Notes:
 * - Does NOT validate the global export — that is the caller’s responsibility.
 * - Renderer scripts may overwrite `window.AppRenderer` as a side effect.
 */
function loadScriptOnce(url: string): Promise<void> {
  const existing = scriptLoadCache.get(url)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = url
    s.async = true
    s.crossOrigin = "anonymous"

    s.addEventListener("load", () => resolve(), { once: true })
    s.addEventListener(
      "error",
      () => reject(new Error(`Failed to load renderer script: ${url}`)),
      { once: true },
    )

    document.head.appendChild(s)
  })

  scriptLoadCache.set(url, promise)

  // Allow retries if the load fails
  promise.catch(() => {
    scriptLoadCache.delete(url)
  })

  return promise
}

/**
 * Loads a renderer module and validates that it conforms to the expected contract.
 *
 * Returns a typed object containing the mount function
 * Throws if the module cannot be imported or does not export a mount() function.
 */
export async function loadRendererModule(url: string): Promise<RendererModule> {
  await loadScriptOnce(url)

  const renderer = window.AppRenderer

  if (!renderer || typeof renderer.mount !== "function") {
    throw new Error(
      `Renderer at ${url} did not register window.AppRenderer.mount()`,
    )
  }

  return renderer
}

/**
 * Imports a renderer module and mounts it into the root element.
 * Used for the single render per coordinator boot.
 *
 * When initArgs is provided, calls init() before mount() to provide
 * the renderer with gating context and coordinator bridges.
 */
export async function mountRendererFromUrl(
  url: string,
  data: AppProps,
  initArgs?: RendererInitArgs,
) {
  // ensure css is loaded first
  const cssFile = data.manifest?.cssFile

  if (cssFile) {
    logger.info("we have a css file", cssFile)
    const base = baseFromModuleUrl(url) // "/remote" or "/static"
    const cssHref = `${base}/${cssFile}`.replace(/([^:]\/)\/+/g, "$1")
    await upsertRendererCssLink(cssHref)
  }

  const renderer = await loadRendererModule(url)

  if (initArgs && renderer.init) {
    await renderer.init(initArgs)
  }

  /**
   * There is no way there won't be a root element ... Or is there ... bum bum bah
   * ... no really, there shouldn't be a missing root since this is all controlled.
   *
   * This is a defensive runtime assertion. The preferred place to catch
   * this is in pre-release checks (templates, integration tests), not here.
   */
  const rootEl = document.getElementById(ROOT_ID)
  if (!rootEl) throw new Error(`Coordinator: missing #${ROOT_ID} element`)

  await renderer.mount(rootEl, data)
  return { update: renderer.update, unmount: renderer.unmount }
}

/**
 * Imports a renderer module only to validate that it loads and exposes mount().
 * The current renderer instance is not touched.
 *
 * Important:
 * - Renderer bundles overwrite `window.AppRenderer` as a side effect.
 * - Validation must restore the previous value to preserve SWR semantics.
 */
export async function validateRendererModule(url: string): Promise<void> {
  const prev = window.AppRenderer

  await loadScriptOnce(url)

  const next = window.AppRenderer
  const ok = Boolean(next && typeof next.mount === "function")

  // Restore current renderer (SWR: don't change "now")
  window.AppRenderer = prev

  if (!ok) {
    throw new Error(
      `Renderer at ${url} did not register window.AppRenderer.mount()`,
    )
  }
}

/**
 * Fetches JSON from a URL with explicit cache semantics.
 * Throws on non-OK responses.
 */
export async function fetchJson<T>(
  url: string,
  cache: RequestCache,
): Promise<T> {
  const res = await fetch(url, { cache })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json() as Promise<T>
}

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
        logger.warn("cache: remote CSS missing; falling back to baked", manifest.cssFile) //prettier-ignore
        return null
      }

      // Let's make sure the `file` is proper shaped
      if (!isJsModulePath(manifest.file)) {
        logger.warn("cache: remote manifest.file is not JS; falling back to baked", manifest.file) //prettier-ignore
        return null
      }

      // Let's pull the actual bundle out of the cache
      const jsUrl = `${REMOTE_PREFIX}/${manifest.file}`
      const jsResponse = await cache.match(jsUrl)

      // If it isn't there, we will just fall back to baked
      if (!jsResponse) {
        logger.warn("cache: remote JS missing; falling back to baked", manifest.file ) //prettier-ignore
        return null
      }

      // If we have reached here, all is well
      logger.info("renderer: cached ✅")
      return { manifest, jsUrl }
    }
  } catch (e) {
    logger.warn("cache: manifest parse failed; falling back to baked", e) //prettier-ignore
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
    `${BAKED_PREFIX}/manifest.json`,
    "reload",
  )

  const jsUrl = `${BAKED_PREFIX}/${manifest.file}`
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
 * - If cache is missing/invalid, fall back to baked-in manifest at BAKED_PREFIX.
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
