import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, loadEnv } from "vite"

const rendererRoot = path.resolve(__dirname, "static")

export default defineConfig(({ mode }) => {
  // load from the repo root .env
  const envDir = fileURLToPath(new URL("../../", import.meta.url))
  const env = loadEnv(mode, envDir, "") // no prefix filter

  const COORDINATOR_PORT = Number(env.VITE_COORDINATOR_PORT)
  const RENDERER_PORT = Number(env.VITE_RENDERER_PORT)
  const TARGET = env.VITE_RENDERER_ORIGIN || `http://localhost:${RENDERER_PORT}`

  if (!/^https?:\/\//.test(TARGET)) {
    throw new Error(`VITE_RENDERER_ORIGIN must be a full URL, got: ${TARGET}`)
  }

  return {
    build: {
      target: "es2020",
      sourcemap: true,
      terserOptions: {
        keep_fnames: true,
      },
    },
    server: {
      port: Number(COORDINATOR_PORT ?? 5173),
      proxy: {
        "/remote": {
          target: "http://localhost:3009",
          changeOrigin: true,
        },
        "/api": {
          target: "http://localhost:3009",
          changeOrigin: true,
        },
      },
    },
    plugins: [
      {
        name: "raw-renderer-bundle",
        configureServer(server) {
          server.middlewares.use(rendererMiddleware(rendererRoot))
        },
        configurePreviewServer(server) {
          // So `vite preview` behaves the same as dev
          server.middlewares.use(rendererMiddleware(rendererRoot))
        },
      },
    ],
  }
})

export function rendererMiddleware(root: string) {
  return function rendererHandler(req: any, res: any, next: any) {
    const base = "/static/"
    if (!req.url?.startsWith(base)) return next()

    const rel = req.url.slice(base.length) ?? ""
    const filePath = path.join(root, rel)

    // Basic path traversal guard
    if (!filePath.startsWith(root)) {
      res.statusCode = 403
      res.end("Forbidden")
      return
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return next()
    }

    res.setHeader("Content-Type", contentTypeFor(filePath))
    fs.createReadStream(filePath).pipe(res)
  }
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8"
    case ".css":
      return "text/css; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".map":
      return "application/json; charset=utf-8"
    case ".svg":
      return "image/svg+xml"
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".woff":
      return "font/woff"
    case ".woff2":
      return "font/woff2"
    default:
      return "application/octet-stream"
  }
}
