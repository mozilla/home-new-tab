/**
 * Geographic context used to fetch weather for the user's location.
 *
 * In production, provided by browser core via the `getGeolocation` transport.
 * All three fields must be present for a valid weather fetch.
 */
export type Geolocation = {
  /** ISO 3166-1 alpha-2 country code (e.g. "US"). */
  country: string
  /** Region or state code (e.g. "CA"). */
  region: string
  /** City name (e.g. "San Francisco"). */
  city: string
}

/**
 * A location suggestion returned by the autocomplete endpoint.
 */
export type LocationSuggestion = {
  /** Display name for this location (city + region). */
  name: string
  /** Region or state code. */
  region: string
  /** ISO 3166-1 alpha-2 country code. */
  country: string
}

export const TemperatureView = {
  Simple: "simple",
  Detailed: "detailed",
  Extreme: "extreme",
}
export type TemperatureView = (typeof TemperatureView)[keyof typeof TemperatureView] //prettier-ignore

export const TemperatureUnit = {
  Celsius: "Celsius",
  Fahrenheit: "Fahrenheit",
  Kelvin: "Kelvin",
}
export type TemperatureUnit = (typeof TemperatureUnit)[keyof typeof TemperatureUnit] //prettier-ignore

export type Temperature = {
  /** Temperature in Celsius. */
  c: number
  /** Temperature in Fahrenheit. */
  f: number
}

export type Conditions = {
  /** Link to full weather conditions page. */
  url: string
  /** Short human-readable description (e.g. "Partly cloudy"). */
  summary: string
  /** Provider-specific icon identifier for the current condition. */
  iconId: number
  /** Current temperature reading. */
  temperature: Temperature
}

export type Forecast = {
  /** Link to full forecast page. */
  url: string
  /** Short human-readable forecast description. */
  summary: string
  /** Expected high temperature. */
  high: Temperature
  /** Expected low temperature. */
  low: Temperature
}

export type WeatherData = {
  /** Display title for the weather widget. */
  title: string
  /** Link to the weather provider's full page. */
  url: string
  /** Name of the weather data provider. */
  provider: string
  /** Whether this weather widget placement is sponsored. */
  isSponsored: boolean
  /** Relevance score used for ranking weather sources. */
  score: number
  /** User's city name for display. */
  cityName: string
  /** Region or state code (e.g. "CA", "NY"). */
  regionCode: string
  /** Current weather conditions. */
  currentConditions: Conditions
  /** Upcoming forecast summary. */
  forecast: Forecast
  /** Identifier for this weather data request. */
  requestId: string
  /** Origin of this weather data (e.g. provider name or endpoint). */
  source: string
}
