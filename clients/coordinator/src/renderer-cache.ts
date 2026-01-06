import { createBufferedLogger } from "@common/utilities/logger"
import { isJsModulePath } from "@common/utilities/values"
import { ROOT_ID, RENDERER_CACHE_NAME, REMOTE_PREFIX, BAKED_PREFIX } from "./constants" //prettier-ignore

import type { AppRenderManifest, RendererModule, BaselineRenderer, AppProps } from "@common/types" // prettier-ignore

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
 * Loads a renderer module and validates that it conforms to the expected contract.
 *
 * Returns a typed object containing the mount function
 * Throws if the module cannot be imported or does not export a mount() function.
 */
export async function loadRendererModule(url: string): Promise<RendererModule> {
  const renderer = await import(/* @vite-ignore */ url)

  // Let's make sure there is a mount function.  We might also check validity more
  // stringently ... but for now, we can just tuck this in there as a guardrail
  if (typeof renderer.mount !== "function") {
    throw new Error(`Renderer at ${url} missing mount() export`)
  }

  return renderer
}

/**
 * Imports a renderer module and mounts it into the root element.
 * Used for the single render per coordinator boot.
 */
export async function mountRendererFromUrl(url: string, data: AppProps) {
  // ensure css is loaded first
  const cssFile = data.manifest?.cssFile

  if (cssFile) {
    logger.info("we have a css file", cssFile)
    const base = baseFromModuleUrl(url) // "/remote" or "/static"
    const cssHref = `${base}/${cssFile}`.replace(/([^:]\/)\/+/g, "$1")
    await upsertRendererCssLink(cssHref)
  }

  const { mount, update } = await loadRendererModule(url)

  /**
   * There is no way there won't be a root element ... Or is there ... bum bum bah
   * ... no really, there shouldn't be a missing root since this is all controlled.
   *
   * This is a defensive runtime assertion. The preferred place to catch
   * this is in pre-release checks (templates, integration tests), not here.
   */
  const rootEl = document.getElementById(ROOT_ID)
  if (!rootEl) throw new Error(`Coordinator: missing #${ROOT_ID} element`)

  await mount(rootEl, data)
  return { update }
}

/**
 * Imports a renderer module only to validate that it loads and exposes mount().
 * The current renderer instance is not touched.
 */
export async function validateRendererModule(url: string): Promise<void> {
  await loadRendererModule(url)
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
