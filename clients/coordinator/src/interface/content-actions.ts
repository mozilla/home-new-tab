import { createBufferedLogger } from "@common/utilities/logger"
import { postEvent } from "./_post"

import type { LinkTarget } from "@common/types"

const logger = createBufferedLogger({ prefix: "coordinator:content-actions" })

/**
 * onBookmarkUrl
 * ---
 * Dev stub for the `bookmarkUrl` host callback. In production, browser
 * core routes this to the Places bookmarks API.
 */
export function onBookmarkUrl(url: string): void {
  logger.info("bookmarkUrl", { url })
  postEvent("bookmarkUrl", { url })
}

/**
 * onDeleteBookmark
 * ---
 * Dev stub for the `deleteBookmark` host callback. In production, browser
 * core routes this to the Places bookmarks API.
 */
export function onDeleteBookmark(id: string): void {
  logger.info("deleteBookmark", { id })
  postEvent("deleteBookmark", { id })
}

/**
 * onDeleteHistory
 * ---
 * Dev stub for the `deleteHistory` host callback. In production, browser
 * core routes this to the Places history API.
 */
export function onDeleteHistory(url: string): void {
  logger.info("deleteHistory", { url })
  postEvent("deleteHistory", { url })
}

/**
 * onOpenLink
 * ---
 * Dev stub for the `openLink` host callback. In production, browser core
 * routes this to the window/tab management API with the given target context.
 */
export function onOpenLink(url: string, target: LinkTarget): void {
  logger.info("openLink", { url, target })
  postEvent("openLink", { url, target })
}

/**
 * onReportContent
 * ---
 * Dev stub for the `reportContent` host callback. In production, browser
 * core routes this to the content reporting pipeline.
 */
export function onReportContent(url: string): void {
  logger.info("reportContent", { url })
  postEvent("reportContent", { url })
}

/**
 * onPinSite
 * ---
 * Dev stub for the `pinSite` host callback. In production, browser core
 * writes the pin to the top sites store.
 */
export function onPinSite(url: string, index: number): void {
  logger.info("pinSite", { url, index })
  postEvent("pinSite", { url, index })
}

/**
 * onUnpinSite
 * ---
 * Dev stub for the `unpinSite` host callback. In production, browser core
 * removes the pin from the top sites store.
 */
export function onUnpinSite(url: string): void {
  logger.info("unpinSite", { url })
  postEvent("unpinSite", { url })
}

/**
 * onSearchHandoff
 * ---
 * Dev stub for the `searchHandoff` host callback. In production, browser
 * core passes the query to the browser's search system.
 */
export function onSearchHandoff(query: string): void {
  logger.info("searchHandoff", { query })
  postEvent("searchHandoff", { query })
}
