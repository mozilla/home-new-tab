/**
 * A top site default record shaped for renderer consumption.
 *
 * Derived from a Remote Settings record in the `newtab-top-sites` collection.
 * The coordinator constructs `imageUrl` from the RS attachment location —
 * the renderer does not need to know the CDN base URL.
 */
export type TopSiteDefault = {
  /** Remote Settings record ID. */
  id: string
  /** Site URL. */
  url: string
  /** Display title. */
  title: string
  /**
   * Fully constructed CDN image URL.
   * Present only when the RS record includes an attachment.
   * Absent for records without an image.
   */
  imageUrl?: string
}

/**
 * A sponsored ad tile from the MARS unified ads endpoint.
 *
 * Ad tiles are a top sites sub-source — they compete with organic and pinned
 * sites for positions in the grid. The renderer owns placement and dedup.
 */
export type AdTile = {
  /** Unique identifier for this tile. */
  id: string
  /** Display title. */
  name: string
  /** Target URL for the tile. */
  url: string
  /** Display image URL. */
  imageUrl: string
  /** Tracking URL fired on click. */
  clickUrl: string
  /** Tracking URL fired on impression. */
  impressionUrl: string
  /** Block key used to persist user blocks back to MARS. */
  blockKey: string
  /** Flight identifier for flight-level blocking. */
  flightId?: string
  /** Suggested grid position, if provided by MARS. */
  position?: number
}

/**
 * A site the user has pinned to a specific top sites position.
 */
export type PinnedSite = {
  /** Site URL. */
  url: string
  /** Display title, if provided at pin time. */
  title?: string
  /** Grid position this site is pinned to. */
  index: number
}

/**
 * A site surfaced from the user's browsing history via the Places frecency algorithm.
 *
 * In production, provided by browser core. In dev, the coordinator returns a
 * static mock array via the `getFrecentSites` transport stub.
 */
export type FrecentSite = {
  /** Site URL. */
  url: string
  /** Page title from history. */
  title: string
  /** Favicon URL, if available. */
  favicon?: string
}

/**
 * Container for top sites sub-sources provided by browser core.
 *
 * RS-backed defaults arrive separately via `CoordinatedData.topSiteDefaults`
 * as raw records. The renderer assembles, deduplicates, and ranks all sub-sources.
 */
export type TopSitesData = {
  /** Sites pinned by the user to specific grid positions. */
  pinned?: PinnedSite[]
  /** Sites from the user's browsing history, ranked by frecency. */
  frecent?: FrecentSite[]
  /** Sponsored ad tiles from MARS. Populated when the ads pipeline is active. */
  adTiles?: AdTile[]
}
