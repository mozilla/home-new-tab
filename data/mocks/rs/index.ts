import wallpapers from "./newtab-wallpapers-v2.json"

/**
 * Map of Remote Settings collection names to their mock records.
 * Adding a new RS-backed data source: add the JSON file + an entry here.
 */
export const rsCollections: Record<string, unknown[]> = {
  "newtab-wallpapers-v2": wallpapers,
}
