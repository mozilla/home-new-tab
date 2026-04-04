import { createBufferedLogger } from "@common/utilities/logger"
import { DATA_SCHEMA_VERSION } from "../constants"
import { getGeolocation } from "../interface/geolocation"

import type { WeatherData } from "@common/types"

const WEATHER_CACHE_NAME = "weather-data"
const WEATHER_TTL_MS = 600_000 // 10 minutes
const WEATHER_ENDPOINT = "/api/weather"

const logger = createBufferedLogger({
  prefix: "Coordinator: Weather",
  groupLabel: "HNT Data Lifecycle",
  shouldBuffer: false,
  colors: {
    log: "#fd0391",
  },
})

function weatherCacheKey(): string {
  return `/data/weather?schema=${encodeURIComponent(DATA_SCHEMA_VERSION)}`
}

function isFresh(updatedAt: string): boolean {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < WEATHER_TTL_MS
}

async function getCachedWeather(): Promise<{
  data: WeatherData
  updatedAt: string
} | null> {
  if (!("caches" in window)) return null
  const cache = await caches.open(WEATHER_CACHE_NAME)
  const res = await cache.match(weatherCacheKey())
  if (!res) return null
  return (await res.clone().json()) as { data: WeatherData; updatedAt: string }
}

async function putCachedWeather(data: WeatherData): Promise<void> {
  if (!("caches" in window)) return
  const cache = await caches.open(WEATHER_CACHE_NAME)
  const entry = { data, updatedAt: new Date().toISOString() }
  await cache.put(
    weatherCacheKey(),
    new Response(JSON.stringify(entry), {
      headers: { "Content-Type": "application/json" },
    }),
  )
}

/**
 * Fetches weather data for the current session.
 *
 * Serves from the source-level cache when fresh (10-minute TTL).
 * Merino is a trusted surface — the response is passed through as-is.
 * Returns null on network failure.
 */

/**
 * Returns weather data if the source-level cache is fresh, null otherwise.
 * No network call — used by the coordinator to check warmth before mount.
 */
export async function readCachedWeather(): Promise<WeatherData | null> {
  const cached = await getCachedWeather()
  if (cached && isFresh(cached.updatedAt)) return cached.data
  return null
}

export async function fetchWeather(): Promise<WeatherData | null> {
  const cached = await getCachedWeather()
  if (cached && isFresh(cached.updatedAt)) {
    logger.info("weather: cache hit", cached.data)
    return cached.data
  }

  logger.info("weather: fetching fresh data")

  const { country, region, city } = getGeolocation()
  const params = new URLSearchParams({ ts: String(Date.now()), country, region, city })

  let raw: unknown
  try {
    const res = await fetch(`${WEATHER_ENDPOINT}?${params}`, {
      cache: "no-store",
    })
    if (!res.ok) {
      logger.warn("weather: fetch failed", res.status)
      return null
    }
    raw = await res.json()
  } catch (e) {
    logger.warn("weather: fetch threw", e)
    return null
  }

  const data = raw as WeatherData
  await putCachedWeather(data)
  logger.info("weather: fetched and cached", data)
  return data
}
