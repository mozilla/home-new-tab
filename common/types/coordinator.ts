import type { DiscoverFeed } from "./discovery"
import type { Message } from "./messaging"
import type { ErrorReport, MetricReport } from "./reporting"
import type { RawSponsoredData } from "./sponsored"
import type { WeatherData } from "./weather"

export type LinkTarget = "current" | "new-tab" | "new-window" | "private"

/**
 * An inbound record from the translations collection.
 *
 * Produced by the translation pipeline and keyed to `l10nHash`, not `snapshotHash`.
 * The coordinator fetches this record to determine locale availability and resolve
 * the FTL resource URL for `getMessages`.
 */
export type TranslationRecord = {
  /** Key-set hash linking this record to a specific baseline. */
  l10nHash: string
  /** BCP 47 locale code for this translation set (e.g. "fr", "de-AT"). Always non-baseline — en-US is delivered through the snapshot channel, not the translations collection. */
  locale: string
  /** Number of keys present in this translation. */
  translatedKeyCount: number
  /** Total keys in the key set (from the baseline). */
  totalKeyCount: number
  /** URL to fetch the FTL resource for this locale. */
  resource: string
}

export type CoordinatorInterface = {
  /** Fetches Fluent messages for the given locale. */
  getMessages: (locale: string) => Promise<string>
  /** Reports an error to the coordinator. */
  reportError?: (report: ErrorReport) => void
  /** Reports a metric measurement to the coordinator. */
  reportMetric?: (report: MetricReport) => void
  /** Blocks a URL from appearing in recommendations. */
  blockUrl?: (url: string) => void
  /** Bookmarks the given URL. */
  bookmarkUrl?: (url: string) => void
  /** Removes a bookmark by its identifier. */
  deleteBookmark?: (id: string) => void
  /** Removes a URL from browsing history. */
  deleteHistory?: (url: string) => void
  /** Opens a URL in the specified target context. */
  openLink?: (url: string, target: LinkTarget) => void
  /** Reports a content item for policy review. */
  reportContent?: (url: string) => void
  /** Pins a site to the given position in top sites. */
  pinSite?: (url: string, index: number) => void
  /** Unpins a site from top sites. */
  unpinSite?: (url: string) => void
  /** Hands off a search query to the browser's search system. */
  searchHandoff?: (query: string) => void
  /** Signals that a message was shown to the user. */
  messageImpressed?: (id: string) => void
  /** Signals that the user dismissed a message. */
  messageDismissed?: (id: string) => void
  /** Signals that the user completed a message's action. */
  messageCompleted?: (id: string) => void
  /** Signals that the user blocked a message. */
  messageBlocked?: (id: string) => void
}

export type CoordinatedData = {
  /** Top sites (frequently visited). Shape TBD. */
  topSites?: unknown
  /** Discovery feed recommendations. */
  discovery?: DiscoverFeed
  /** Sponsored content placements (raw from upstream). */
  sponsored?: RawSponsoredData
  /** Current weather data. */
  weather?: WeatherData
  /** Wallpaper configuration. Shape TBD. */
  wallpapers?: unknown
  /** System and promotional messages for the renderer. */
  messages?: Message[]
  /** Widget configuration. Shape TBD. */
  widgets?: unknown
}

export type CoordinatedPayload = {
  /** Data schema version for coordinator-renderer compatibility. */
  schemaVersion: string
  /** ISO timestamp of when this payload was assembled. */
  updatedAt: string
  /** Coordinated data sources, if available. */
  data?: CoordinatedData
}
