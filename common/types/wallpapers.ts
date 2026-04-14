/**
 * A wallpaper record as received from Remote Settings.
 *
 * Raw records arrive via `CoordinatedData.wallpapers` as `unknown[]`.
 * The renderer casts to this type and constructs `wallpaperUrl` from
 * `attachment.location` using its own CDN base constant.
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
  /** RS attachment, present when the record has an image. */
  attachment?: {
    location: string
    hash: string
    size: number
    mimetype: string
  }
}
