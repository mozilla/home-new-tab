import { createBufferedLogger } from "@common/utilities/logger"
import { postEvent } from "./_post"
import { readJson } from "./_storage"

const logger = createBufferedLogger({ prefix: "coordinator:block-list" })

// Storage key for blocked URLs. Defined here so browser core knows where to
// write when this stub is replaced with a real integration.
const STORAGE_KEY = "coordinator:blocked-urls"

/**
 * getBlockedUrls
 * ---
 * Returns URLs the user has blocked, for use in request builders that need
 * to filter them from results. Returns an empty array if nothing is stored
 * yet or if storage is unavailable.
 *
 * In dev, this always returns [] — nothing writes to the block list until
 * browser core provides a real implementation.
 */
export function getBlockedUrls(): string[] {
  return readJson<string[]>(STORAGE_KEY, [])
}

/**
 * onBlockUrl
 * ---
 * Dev stub for the `blockUrl` host callback. Logs the action so it's
 * visible during development. Browser core owns the real write behavior.
 */
export function onBlockUrl(url: string): void {
  logger.info("blockUrl", { url })
  postEvent("blockUrl", { url })
}
