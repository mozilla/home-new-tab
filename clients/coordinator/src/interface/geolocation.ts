import type { Geolocation } from "@common/types"

// Static mock for the dev reference. In production, browser core provides
// real geolocation from the platform's location APIs.
const DEV_GEOLOCATION: Geolocation = {
  country: "US",
  region: "CA",
  city: "San Francisco",
}

/**
 * getGeolocation
 * ---
 * Transport stub for the platform geolocation API. Returns the user's country,
 * region, and city for inclusion in the Merino weather request.
 *
 * In production, browser core provides this from the platform's location
 * detection APIs (all three fields must be present for a valid weather fetch).
 * The dev stub returns a static location so the pattern is exercised.
 */
export function getGeolocation(): Geolocation {
  return DEV_GEOLOCATION
}
