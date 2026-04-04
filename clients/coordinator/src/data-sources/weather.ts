import { createBufferedLogger } from "@common/utilities/logger"
import { DATA_SCHEMA_VERSION } from "../constants"
import { getGeolocation } from "../interface/geolocation"

import type { WeatherData } from "@common/types"

const WEATHER_CACHE_NAME = "weather-data"
const WEATHER_TTL_MS = 600_000 // 10 minutes — trigger background refresh
const WEATHER_MAX_AGE_MS = 3_600_000 // 1 hour — drop rather than show stale
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

function isWithinMaxAge(updatedAt: string): boolean {
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < WEATHER_MAX_AGE_MS
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
 * Marks the weather cache entry as stale by backdating its timestamp.
 * The data is preserved so the next load shows ↻ (stale) rather than ⏳ (pending),
 * and the deferred pipeline fires a fresh fetch to replace it.
 */
export async function clearCachedWeather(): Promise<void> {
  const cached = await getCachedWeather()
  if (!cached) return
  if (!("caches" in window)) return
  const cache = await caches.open(WEATHER_CACHE_NAME)
  const stale = { data: cached.data, updatedAt: new Date(Date.now() - WEATHER_TTL_MS - 1).toISOString() }
  await cache.put(
    weatherCacheKey(),
    new Response(JSON.stringify(stale), {
      headers: { "Content-Type": "application/json" },
    }),
  )
}

/**
 * Expires the weather cache entry by deleting the underlying Cache API entry.
 * After this call, readCachedWeather() returns null — the next load treats
 * weather as a cold-start pending source and delivers data via update().
 */
export async function expireCachedWeather(): Promise<void> {
  if (!("caches" in window)) return
  const cache = await caches.open(WEATHER_CACHE_NAME)
  await cache.delete(weatherCacheKey())
}

/**
 * Returns the cached weather entry and whether it is still fresh.
 * Returns null if no cache entry exists at all.
 * No network call — used by the coordinator to assess warmth before mount.
 */
export async function readCachedWeather(): Promise<{ data: WeatherData; fresh: boolean; updatedAt: string } | null> {
  const cached = await getCachedWeather()
  if (!cached) return null
  if (!isWithinMaxAge(cached.updatedAt)) return null
  return { data: cached.data, fresh: isFresh(cached.updatedAt), updatedAt: cached.updatedAt }
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
