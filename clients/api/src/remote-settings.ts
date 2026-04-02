import { Hono } from "hono"

import { rsCollections } from "@data/mocks/rs"

export const rsRoutes = new Hono()

/**
 * Remote Settings simulation — collection records endpoint.
 *
 * Mirrors the RS server URL structure: /rs/:collection/records
 * Mock data is registered in data/mocks/rs/index.ts.
 * Returns 404 for unknown collections.
 */
rsRoutes.get("/:collection/records", (c) => {
  const { collection } = c.req.param()
  const records = rsCollections[collection]

  if (!records) {
    return c.json({ error: `unknown collection: ${collection}` }, 404)
  }

  return c.json(records)
})
