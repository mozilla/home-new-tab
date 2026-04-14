import { createBufferedLogger } from "@common/utilities/logger"
import { getRemoteSettings } from "../remote-settings"

import type { CoordinatedData } from "@common/types"
import type { RSDescriptor } from "../data-schema"

const logger = createBufferedLogger({
  prefix: "Coordinator: RS",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fd0391",
  },
})

/**
 * Fetches records from a Remote Settings collection and returns them as raw
 * unknown[] under the descriptor's key.
 *
 * Pure pass-through — no field construction, no normalization. The renderer
 * receives the raw RS JSON blobs and constructs what it needs (e.g. imageUrl,
 * wallpaperUrl) using its own CDN base constant.
 *
 * RS is its own cache — no coordinator-level Cache API layer is needed.
 * The SWR cycle in data-cache.ts controls how often this runs per session.
 *
 * Returns { [key]: records[] } on success, null on failure.
 */
export async function fetch(
  entry: RSDescriptor,
): Promise<Partial<CoordinatedData> | null> {
  try {
    const client = getRemoteSettings<unknown>(entry.collection)
    const records = await client.get()
    logger.info(`${entry.key}: fetched ${records.length} RS records`, {
      collection: entry.collection,
    })
    return { [entry.key]: records } as Partial<CoordinatedData>
  } catch (e) {
    logger.warn(`${entry.key}: RS fetch threw`, e)
    return null
  }
}
