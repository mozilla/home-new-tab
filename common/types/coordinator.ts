import type { DiscoverFeed } from "./discovery"
import type { TopSitesData } from "./top-sites"
import type { Message } from "./messaging"
import type { RawSponsoredData } from "./sponsored"
import type { WeatherData } from "./weather"

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

export type CoordinatedData = {
  /** Top sites sub-sources (pinned, frecent). Assembled by the renderer. */
  topSites?: TopSitesData
  /** Raw Remote Settings records from newtab-top-sites. Renderer constructs imageUrl from attachment.location. */
  topSiteDefaults?: unknown[]
  /** Discovery feed recommendations. */
  discovery?: DiscoverFeed
  /** Sponsored content placements (raw from upstream). */
  sponsored?: RawSponsoredData
  /** Current weather data. */
  weather?: WeatherData
  /** Raw Remote Settings records from newtab-wallpapers-v2. Renderer constructs wallpaperUrl from attachment.location. */
  wallpapers?: unknown[]
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
