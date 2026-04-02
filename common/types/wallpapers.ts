/**
 * A wallpaper record shaped for renderer consumption.
 *
 * Derived from a Remote Settings record in the `newtab-wallpapers-v2` collection.
 * The coordinator constructs `wallpaperUrl` from the RS attachment location —
 * the renderer does not need to know the CDN base URL.
 */
export type WallpaperRecord = {
  /** Remote Settings record ID. */
  id: string
  /** RS last-modified timestamp (Unix ms). */
  last_modified: number
  /** Display title and selection identifier. */
  title: string
  /** Category grouping (empty string if uncategorized). */
  category: string
  /** Display order within category (0 if unspecified). */
  order: number
  /** CSS background-position value ("center" if unspecified). */
  background_position: string
  /**
   * Fully constructed CDN image URL.
   * Present only when the RS record includes an attachment.
   * Absent for records without an image (e.g. solid-color or default entries).
   */
  wallpaperUrl?: string
}
