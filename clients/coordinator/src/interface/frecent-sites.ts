import type { FrecentSite } from "@common/types"

// Static mock for the dev reference. In production, browser core provides
// real frecency data from the Places history API.
const DEV_FRECENT_SITES: FrecentSite[] = [
  { url: "https://www.example.com", title: "Example" },
  { url: "https://www.wikipedia.org", title: "Wikipedia" },
  { url: "https://www.github.com", title: "GitHub" },
]

/**
 * getFrecentSites
 * ---
 * Transport stub for the Places frecency API. Returns the user's most visited
 * sites ranked by frecency for inclusion in the top sites sub-source assembly.
 *
 * In production, browser core provides this data directly. The dev stub
 * returns a static array so the shape is exercised without a real Places query.
 */
export function getFrecentSites(): FrecentSite[] {
  return DEV_FRECENT_SITES
}