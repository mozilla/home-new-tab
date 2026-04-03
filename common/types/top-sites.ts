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
 * Container for all top sites sub-sources.
 *
 * Sub-sources are added here as they land without requiring changes to
 * `CoordinatedData`. The renderer assembles, deduplicates, and ranks them.
 */
export type TopSitesData = {
  /** Curated top site defaults from Remote Settings. */
  defaults?: TopSiteDefault[]
  /** Sponsored ad tiles from MARS. Populated when the ads pipeline is active. */
  adTiles?: AdTile[]
}
