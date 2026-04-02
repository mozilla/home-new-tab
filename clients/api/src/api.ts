import "dotenv/config"
import { promises as fs } from "fs"
import { Hono } from "hono"
import { env } from "hono/adapter"
import path from "path"

import discoverMock from "@data/mocks/merino-curated.json"
import weatherMock from "@data/mocks/weather.json"

import type { DiscoverFeed, TranslationRecord } from "@common/types"

const STORAGE_DIR = path.resolve(process.cwd(), "data")
const MOCK_PATH = path.join(STORAGE_DIR, "mock.json")
const L10N_DIR = path.join(STORAGE_DIR, "remote/poc/l10n")

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
 * Fake translation record endpoint for dev l10n testing
 * Returns a TranslationRecord for the given hash and locale if the baseline FTL artifact exists.
 * Key counts are synthetic: 0/0 → completeness = 1 → "full"; pass ?partial=true for 1/2 → "partial".
 */
apiRoutes.get("/l10n/translations/:l10nHash/:locale", async (c) => {
  const { l10nHash, locale } = c.req.param()
  const partial = c.req.query("partial") === "true"
  const ftlPath = path.join(L10N_DIR, l10nHash, "artifacts", "en-US.ftl")

  try {
    await fs.access(ftlPath)
  } catch {
    return c.json({ error: "not found" }, 404)
  }

  const record: TranslationRecord = {
    l10nHash,
    locale,
    translatedKeyCount: partial ? 1 : 0,
    totalKeyCount: partial ? 2 : 0,
    resource: `/api/l10n/resource/${l10nHash}/${locale}`,
  }
  return c.json(record)
})

/**
 * Fake translation resource endpoint for dev l10n testing
 * Returns the baseline FTL with each message value prefixed by [locale] so
 * translated content is visually distinguishable during development.
 */
apiRoutes.get("/l10n/resource/:l10nHash/:locale", async (c) => {
  const { l10nHash, locale } = c.req.param()
  const ftlPath = path.join(L10N_DIR, l10nHash, "artifacts", "en-US.ftl")

  let ftl: string
  try {
    ftl = await fs.readFile(ftlPath, "utf8")
  } catch {
    return c.text("not found", 404)
  }

  const prefixed = ftl
    .split("\n")
    .map((line) => line.replace(/^(\S[^=\n]*= )(.+)$/, `$1[${locale}] $2`))
    .join("\n")

  return c.text(prefixed, 200, { "Content-Type": "text/plain; charset=utf-8" })
})

/**
 * Discover feed endpoint
 * Proxies requests to external discover service to fetch curated articles/content feed
 */
apiRoutes.get("/discover", async (c) => {
  const { DISCOVER_ENDPOINT } = env<{ DISCOVER_ENDPOINT: string }>(c)
  if (!DISCOVER_ENDPOINT) {
    return c.json(discoverMock)
  }

  try {
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
 * Weather mock endpoint for dev
 * Returns the first entry from the local weather mock file as a WeatherData object.
 */
apiRoutes.get("/weather", (c) => {
  const [requestId, entry] = Object.entries(weatherMock)[0]
  return c.json({ ...(entry as object), requestId })
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
 * events
 * ---
 * Receives coordinator interface events from the renderer side during
 * development. Logs each event server-side so the full chain
 * (renderer → coordinator → API) is visible in one place.
 *
 * Body shape: `{ action: string, data: unknown }`
 */
apiRoutes.post("/events", async (c) => {
  const body = await c.req.json<{ action: string; data: unknown }>()
  console.log("[event]", body.action, body.data)
  return c.json({ ok: true })
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
