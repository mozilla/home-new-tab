import { createBufferedLogger } from "@common/utilities/logger"
import { readJson, writeJson } from "./_storage"

import type { PinnedSite } from "@common/types"

const logger = createBufferedLogger({
  prefix: "Bridge:Pinned-sites",
  shouldBuffer: false,
  colors: { log: "#ff6c11" },
})

const STORAGE_KEY = "coordinator:pinned-sites"

/**
 * getPinnedSites
 * ---
 * Returns the user's pinned sites from coordinator storage, for inclusion in
 * the top sites sub-source assembly. Returns an empty array if nothing is stored.
 */
export function getPinnedSites(): PinnedSite[] {
  return readJson<PinnedSite[]>(STORAGE_KEY, [])
}

/**
 * onPinSite
 * ---
 * Records a site pin in coordinator storage at the given grid index.
 * If the URL is already pinned, its index is updated.
 */
export function onPinSite(url: string, index: number): void {
  const pinned = getPinnedSites()
  const existing = pinned.findIndex((s) => s.url === url)
  const updated =
    existing >= 0
      ? pinned.map((s, i) => (i === existing ? { ...s, index } : s))
      : [...pinned, { url, index }]
  writeJson(STORAGE_KEY, updated)
  logger.info("pinSite", { url, index })
}

/**
 * onUnpinSite
 * ---
 * Removes a pinned site from coordinator storage by URL.
 */
export function onUnpinSite(url: string): void {
  const pinned = getPinnedSites()
  writeJson(
    STORAGE_KEY,
    pinned.filter((s) => s.url !== url),
  )
  logger.info("unpinSite", { url })
}