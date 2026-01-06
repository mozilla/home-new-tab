import "dotenv/config"

import { Hono } from "hono"
import { env } from "hono/adapter"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { readPriorities, writePriorities, readMock } from "./storage"
import type { DiscoverFeed, DiscoveryItem, PriorityMap } from "@common/types"
import path from "path"

export const staticRoutes = new Hono()
staticRoutes.get("/ping", (c) => c.json({ ok: true }))
staticRoutes.get("/health", (c) => c.json({ ok: true }))

// --- Get render bundles
staticRoutes.get(
  "remote/*",
  serveStatic({ root: path.resolve(process.cwd(), "./data/") }),
)

export const apiRoutes = new Hono()
// --- Get Feed
apiRoutes.get("/discover", async (c) => {
  try {
    const { DISCOVER_ENDPOINT } = env<{ DISCOVER_ENDPOINT: string }>(c)
    if (!DISCOVER_ENDPOINT) throw new Error("endpoint malformed")

    // Getting the latest!
    const response: DiscoverFeed = await fetch(DISCOVER_ENDPOINT, {
      credentials: "omit",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "content-type": "application/json",
        "Idempotency-Key": '"9301233184877052938"',
        Priority: "u=4",
      },
      body: '{"utc_offset":17,"coarse_os":"mac","surface_id":"","inferredInterests":null,"locale":"en-US","region":"US","topics":[],"sections":[],"enableInterestPicker":false,"feeds":["sections"]}',
      method: "POST",
      mode: "cors",
    }).then((response) => response.json())

    // Patch in any overrides
    const priorities = (await readPriorities()) ?? {}
    const patched = patchDiscoveryFeed(response, priorities)
    return c.json(patched)
  } catch (err) {
    console.log(err)
    return c.json({ ok: true, msg: "oops!" })
  }
})

// --- Read current overrides
apiRoutes.get("/priority", async (c) => {
  const map = await readPriorities()
  return c.json(map)
})

// --- Get Mock for testing renderer
apiRoutes.get("/mock", async (c) => {
  const shouldDelay = true
  const map = await readMock(shouldDelay)
  return c.json(map)
})

// --- Upsert overrides
apiRoutes.put("/priority", async (c) => {
  try {
    const body = await c.req.json()
    const { corpusItemId, priority } = body

    if (!corpusItemId || !priority)
      return c.json({ error: "Missing fields" }, 400)
    const current = await readPriorities()
    const next: PriorityMap = { ...current, [corpusItemId]: priority }
    await writePriorities(next)
    return c.json({ ok: true, next })
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }
})

// --- Utility functions
function patchDiscoveryFeed(
  discoverResponse: DiscoverFeed,
  priorities: Record<string, string>,
): DiscoverFeed {
  // Mutating for ease of use ... We aren't worried about collisions ... aaaand I am being lazy
  for (const feed of Object.values(discoverResponse.feeds ?? {})) {
    feed.recommendations = feed.recommendations.map((item) =>
      patch(item, priorities),
    )
  }

  return discoverResponse
}

// Patch in our priorities NOTE: This is all temporary and would be handled by the backend
function patch(item: DiscoveryItem, priorities: PriorityMap): DiscoveryItem {
  const itemId = item.corpusItemId
  const needsPatch = itemId && priorities[itemId]

  return needsPatch ? { ...item, priority: priorities[itemId] } : item
}

// Our actual server
const app = new Hono()

// Mount app
app.route("/", staticRoutes)
app.route("/api", apiRoutes)

const port = Number(3009)
console.log(`API on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
