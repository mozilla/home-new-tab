import { createBufferedLogger } from "@common/utilities/logger"
import { getRemoteSettings } from "../remote-settings"

import type { TopSiteDefault } from "@common/types"

const COLLECTION = "newtab-top-sites"
const CDN_BASE = "https://firefox-settings-attachments.cdn.mozilla.net/"

const logger = createBufferedLogger({
  prefix: "Coordinator: Top Sites",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fd0391",
  },
})

/**
 * Raw shape of a record from the newtab-top-sites RS collection.
 * RS records are JSON blobs — attachment is optional.
 */
type RSTopSiteRecord = {
  id: string
  last_modified: number
  url: string
  title: string
  attachment?: {
    location: string
    hash: string
    size: number
    mimetype: string
  }
}

/**
 * Fetches curated top site default records from Remote Settings.
 *
 * RS is local-first — no coordinator-level cache is needed. The SWR cycle
 * in data-cache.ts controls how often this runs.
 *
 * Raw RS records are shaped into TopSiteDefault: imageUrl is constructed
 * from attachment.location when present. Records without an attachment
 * have no imageUrl.
 *
 * Returns null on failure.
 */
export async function fetchTopSiteDefaults(): Promise<TopSiteDefault[] | null> {
  try {
    const client = getRemoteSettings<RSTopSiteRecord>(COLLECTION)
    const records = await client.get()

    const defaults: TopSiteDefault[] = records.map((r) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      ...(r.attachment
        ? { imageUrl: `${CDN_BASE}${r.attachment.location}` }
        : {}),
    }))

    logger.info(`top-sites: fetched ${defaults.length} defaults`, defaults)
    return defaults
  } catch (e) {
    logger.warn("top-sites: fetch threw", e)
    return null
  }
}
