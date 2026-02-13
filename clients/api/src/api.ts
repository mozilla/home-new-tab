import "dotenv/config"

import { Hono } from "hono"
import { env } from "hono/adapter"
import type { DiscoverFeed } from "@common/types"

import { promises as fs } from "fs"
import path from "path"

const STORAGE_DIR = path.resolve(process.cwd(), "data")
const MOCK_PATH = path.join(STORAGE_DIR, "mock.json")

/**
 * Common fetch configuration for proxy endpoints
 * Reusable headers and options shared across API requests
 */
const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.5",
  "content-type": "application/json",
  Priority: "u=4",
}

export const apiRoutes = new Hono()

/**
 * Mock endpoint for PoC testing
 * Provides mock data for renderer during development/testing
 * Includes artificial delay to simulate network latency
 */
apiRoutes.get("/mock", async (c) => {
  const shouldDelay = true
  const map = await readMock(shouldDelay)
  return c.json(map)
})

/**
 * Discover feed endpoint
 * Proxies requests to external discover service to fetch curated articles/content feed
 */
apiRoutes.get("/discover", async (c) => {
  try {
    const { DISCOVER_ENDPOINT } = env<{ DISCOVER_ENDPOINT: string }>(c)
    if (!DISCOVER_ENDPOINT) throw new Error("endpoint malformed")

    // Getting the latest!
    const response: DiscoverFeed = await fetch(DISCOVER_ENDPOINT, {
      credentials: "omit" as RequestCredentials,
      method: "POST",
      mode: "cors" as RequestMode,
      headers: {
        ...BASE_HEADERS,
        "Idempotency-Key": '"9301233184877052938"',
      },
      body: JSON.stringify({
        utc_offset: 17,
        coarse_os: "mac",
        surface_id: "",
        inferredInterests: null,
        locale: "en-US",
        region: "US",
        topics: [],
        sections: [],
        enableInterestPicker: false,
        feeds: ["sections"],
      }),
    }).then((response) => response.json())

    return c.json(response)
  } catch (err) {
    console.log(err)
    return c.json({ ok: true, msg: "oops!" })
  }
})

/**
 * Weather report endpoint
 * Proxies requests to external weather service for current conditions
 */
apiRoutes.get("/weather/weather-report", async (c) => {
  try {
    const { WEATHER_ENDPOINT } = env<{ WEATHER_ENDPOINT: string }>(c)
    if (!WEATHER_ENDPOINT) throw new Error("endpoint malformed")

    const params = new URLSearchParams({
      q: "",
      providers: "accuweather",
      request_type: "weather",
      source: "newtab",
      country: "US",
      region: "CA",
      city: "Santa Cruz",
    })

    const response = await fetch(`${WEATHER_ENDPOINT}?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const text = await response.text() // Log raw response for debugging
      console.log(text)
      throw new Error(`Weather API failed: ${response.status} - ${text}`)
    }

    const data = await response.json()

    return c.json(data)
  } catch (err) {
    console.log(err)
    return c.json({ ok: true, msg: "oops!" })
  }
})

/**
 * Reads mock data from local JSON file
 * @param shouldDelay - If true, adds 2s delay to simulate network latency
 * @returns Parsed JSON object from mock.json file
 */
export async function readMock(
  shouldDelay: boolean = false,
): Promise<{ color?: string }> {
  // Adding this delay to simulate some approximation of latency
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))
  if (shouldDelay) await delay(2000)

  const raw = await fs.readFile(MOCK_PATH, "utf8")
  try {
    return JSON.parse(raw)
  } catch {
    // file was corrupted or hand-edited incorrectly; reset
    return {}
  }
}
