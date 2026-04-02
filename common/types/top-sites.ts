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
 * Container for all top sites sub-sources.
 *
 * Only `defaults` (Remote Settings) is populated in the initial pipeline.
 * Additional sub-sources (frecent, pinned) are added here as they land
 * without requiring changes to `CoordinatedData`.
 */
export type TopSitesData = {
  /** Curated top site defaults from Remote Settings. */
  defaults?: TopSiteDefault[]
}
