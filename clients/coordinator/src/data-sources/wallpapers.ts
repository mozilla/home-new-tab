import { createBufferedLogger } from "@common/utilities/logger"
import { getRemoteSettings } from "../remote-settings"

import type { WallpaperRecord } from "@common/types"

const COLLECTION = "newtab-wallpapers-v2"
const CDN_BASE = "https://firefox-settings-attachments.cdn.mozilla.net/"

const logger = createBufferedLogger({
  prefix: "Coordinator: Wallpapers",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fd0391",
  },
})

/**
 * Raw shape of a record from the newtab-wallpapers-v2 RS collection.
 * RS records are JSON blobs — attachment is optional.
 */
type RSWallpaperRecord = {
  id: string
  last_modified: number
  title: string
  category?: string
  order?: number
  background_position?: string
  attachment?: {
    location: string
    hash: string
    size: number
    mimetype: string
  }
}

/**
 * Fetches curated wallpaper records from Remote Settings.
 *
 * RS is local-first — no coordinator-level cache is needed. The SWR cycle
 * in data-cache.ts controls how often this runs.
 *
 * Raw RS records are shaped into WallpaperRecord: defaults are normalized
 * and wallpaperUrl is constructed from attachment.location when present.
 * Records without an attachment (e.g. solid-color entries) have no wallpaperUrl.
 *
 * Returns null on failure.
 */
export async function fetchWallpapers(): Promise<WallpaperRecord[] | null> {
  try {
    const client = getRemoteSettings<RSWallpaperRecord>(COLLECTION)
    const records = await client.get()

    const wallpapers: WallpaperRecord[] = records.map((r) => ({
      id: r.id,
      last_modified: r.last_modified,
      title: r.title,
      category: r.category ?? "",
      order: r.order ?? 0,
      background_position: r.background_position ?? "center",
      ...(r.attachment
        ? { wallpaperUrl: `${CDN_BASE}${r.attachment.location}` }
        : {}),
    }))

    logger.info(`wallpapers: fetched ${wallpapers.length} records`, wallpapers)
    return wallpapers
  } catch (e) {
    logger.warn("wallpapers: fetch threw", e)
    return null
  }
}
