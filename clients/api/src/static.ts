import "dotenv/config"

import path from "path"
import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"

export const staticRoutes = new Hono()
staticRoutes.get("/ping", (c) => c.json({ ok: true }))
staticRoutes.get("/health", (c) => c.json({ ok: true }))

// --- Get render bundles
staticRoutes.get(
  "remote/*",
  serveStatic({ root: path.resolve(process.cwd(), "./data/") }),
)
