import { createBufferedLogger } from "@common/utilities/logger"
import { ROOT_ID } from "./constants"

import type { RendererModule, AppProps, RendererInitArgs } from "@common/types"

declare global {
  interface Window {
    AppRenderer?: RendererModule
  }
}

export const logger = createBufferedLogger({
  prefix: "Coordinator: Renderer",
  groupLabel: "HNT Renderer Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fdd303",
  },
})

const RENDERER_CSS_ATTR = "data-hnt-renderer-css"

// High level so we can maintain a record without clobbering it
const scriptLoadCache = new Map<string, Promise<void>>()

/**
 * Loader options. Pass `cacheName` to load bytes from the named Cache API
 * entry (as a blob URL) instead of going to the network. Used when the
 * coordinator selects a previously cached renderer — the source of truth
 * for those bytes is the cache, not the upstream URL (which may no longer
 * be addressable, e.g. after a local Vite rebuild rotates the hash).
 */
type LoaderOptions = { cacheName?: string }

function baseFromModuleUrl(moduleUrl: string) {
  return moduleUrl.replace(/\/[^/]*$/, "")
}

/**
 * Returns a blob URL for a cached response, or null if not in cache.
 * The caller is responsible for revoking the blob URL after use.
 */
async function makeBlobUrlFromCache(
  url: string,
  cacheName: string,
): Promise<string | null> {
  if (!("caches" in window)) return null
  try {
    const cache = await caches.open(cacheName)
    const response = await cache.match(url)
    if (!response) return null
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (e) {
    logger.warn("cache: blob load failed", { url, error: e })
    return null
  }
}

async function upsertRendererCssLink(href: string, options?: LoaderOptions) {
  logger.info("Upserting CSS")
  const head = document.head
  head
    .querySelectorAll(`link[${RENDERER_CSS_ATTR}="1"]`)
    .forEach((n) => n.remove())

  const blobUrl = options?.cacheName
    ? await makeBlobUrlFromCache(href, options.cacheName)
    : null

  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = blobUrl ?? href
  link.setAttribute(RENDERER_CSS_ATTR, "1")
  link.addEventListener("error", () => logger.error("css error", { href }))
  if (blobUrl) {
    link.addEventListener("load", () => URL.revokeObjectURL(blobUrl), {
      once: true,
    })
  }

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
 * When `options.cacheName` is provided, the script bytes are read from the
 * named Cache API entry and executed via a blob URL — so the load does not
 * depend on the URL still being addressable on the network.
 *
 * Notes:
 * - Does NOT validate the global export — that is the caller's responsibility.
 * - Renderer scripts may overwrite `window.AppRenderer` as a side effect.
 */
function loadScriptOnce(url: string, options?: LoaderOptions): Promise<void> {
  // Dedupe by the original URL so repeated calls share a single load,
  // regardless of whether one of them used a blob source.
  const existing = scriptLoadCache.get(url)
  if (existing) return existing

  const promise = (async () => {
    const blobUrl = options?.cacheName
      ? await makeBlobUrlFromCache(url, options.cacheName)
      : null

    return new Promise<void>((resolve, reject) => {
      const s = document.createElement("script")
      s.src = blobUrl ?? url
      s.async = true
      s.crossOrigin = "anonymous"

      const cleanup = () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl)
      }

      s.addEventListener(
        "load",
        () => {
          cleanup()
          resolve()
        },
        { once: true },
      )
      s.addEventListener(
        "error",
        () => {
          cleanup()
          reject(new Error(`Failed to load renderer script: ${url}`))
        },
        { once: true },
      )

      document.head.appendChild(s)
    })
  })()

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
 * Returns a typed object containing the mount function.
 * Throws if the module cannot be imported or does not export a mount() function.
 */
export async function loadRendererModule(
  url: string,
  options?: LoaderOptions,
): Promise<RendererModule> {
  await loadScriptOnce(url, options)

  const renderer = window.AppRenderer

  if (!renderer || typeof renderer.mount !== "function") {
    throw new Error(
      `Renderer at ${url} did not register window.AppRenderer.mount()`,
    )
  }

  return renderer
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
  options?: LoaderOptions,
) {
  // ensure css is loaded first
  const cssFile = data.manifest?.cssFile

  if (cssFile) {
    logger.info("we have a css file", cssFile)
    const base = baseFromModuleUrl(url) // "/remote" or "/static"
    const cssHref = `${base}/${cssFile}`.replace(/([^:]\/)\/+/g, "$1")
    await upsertRendererCssLink(cssHref, options)
  }

  const renderer = await loadRendererModule(url, options)

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
