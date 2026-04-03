import { serve } from "@hono/node-server"
import "dotenv/config"
import { Hono } from "hono"
import { apiRoutes } from "./api"
import { rsRoutes } from "./remote-settings"
import { staticRoutes } from "./static"

// Our actual server
const app = new Hono()

// Mount app
app.route("/", staticRoutes)
app.route("/api", apiRoutes)
app.route("/rs", rsRoutes)

const port = Number(3009)
console.log(`API on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
