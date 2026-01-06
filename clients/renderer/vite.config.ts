import react from "@vitejs/plugin-react-swc"
import { mkdir, writeFile, readdir } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { defineConfig, type Plugin } from "vite"

import type { AppRenderManifest } from "@common/types"

/**
 * Replace all `__BUILD_HASH__` occurrences in the final JS with the real hash.
 * Matches files that look like: index.<hash>.js
 */
function exposeBuildHash(): Plugin {
  return {
    name: "expose-build-hash",
    generateBundle(_options: any, bundle: Record<string, any>) {
      const file = Object.keys(bundle).find(
        (k) => k.startsWith("index.") && k.endsWith(".js"),
      )
      if (!file) return
      const chunk = bundle[file]
      const hash = file.match(/^index\.([^.]+)\.js$/)?.[1] ?? "dev"
      if (typeof chunk.code === "string") {
        chunk.code = chunk.code.replaceAll("__BUILD_HASH__", hash)
      }
    },
  }
}

/**
 * Emit dist/manifest.json describing the renderer bundle.
 * For the coordinator’s server context, we point to `/renderer/<file>`.
 */
function emitRendererManifest(): Plugin {
  return {
    name: "emit-renderer-manifest",
    enforce: "post",
    async generateBundle(_options, bundle) {
      const entryFile = Object.keys(bundle).find(
        (k) => k.startsWith("index.") && k.endsWith(".js"),
      )
      if (!entryFile) return

      const version = process.env.npm_package_version as string
      const buildTime = new Date().toISOString()
      const hash = entryFile.match(/^index\.([^.]+)\.js$/)?.[1] ?? "dev"
      const entryChunk = bundle[entryFile] as any

      // Most reliable to use Vite’s metadata if available
      const cssFromMeta: string[] = entryChunk.viteMetadata?.importedCss
        ? Array.from(entryChunk.viteMetadata.importedCss)
        : []

      const cssFile =
        cssFromMeta[0] ??
        Object.keys(bundle).find(
          (k) => k.endsWith(".css") && !k.endsWith(".css.map"),
        )

      const manifest: AppRenderManifest = {
        version,
        buildTime,
        file: `index.${hash}.js`,
        hash,
        dataSchemaVersion: "1.2.1",
        cssFile: cssFile ?? undefined,
      }

      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifest, null, 2),
      })
    },
  }
}

/**
 * Duplicate the built renderer into another location (e.g. coordinator / API data dir).
 *
 * If `options.ifMissing` is true, we will *only* copy if no `index.*.js` exists
 * in the destination folder. This lets you:
 *
 * - bootstrap a default renderer for new devs, but
 * - leave a “baked in” renderer alone once it exists.
 */
function duplicateOutput(
  destRoot: string,
  folder: string = "renderer",
  options?: { ifMissing?: boolean },
): Plugin {
  const { ifMissing = false } = options ?? {}

  const envForce =
    process.env.REBUNDLE === "1" || process.env.REBUNDLE === "true"

  return {
    name: "duplicate-output",
    enforce: "post",
    async writeBundle(this, _options, bundle) {
      const destRenderer = resolve(destRoot, folder)

      if (ifMissing && !envForce) {
        // Look for an existing index.<hash>.js in the destination.
        let hasExisting = false
        let hasManifest = false
        try {
          const files = await readdir(destRenderer)
          hasExisting = files.some(
            (f) => f.startsWith("index.") && f.endsWith(".js"),
          )
          hasManifest = files.includes("manifest.json")
        } catch {
          // ENOENT etc → folder doesn't exist yet, so definitely no renderer
          hasExisting = false
          hasManifest = false
        }

        if (hasExisting && hasManifest) {
          console.log(
            `[duplicate-output] existing renderer detected in ${destRenderer}, skipping mirror.`,
          )
          return
        }
      }

      await mkdir(destRenderer, { recursive: true })

      // copy each file as-is (preserves hashed name)
      await Promise.all(
        Object.entries(bundle).map(async ([fileName, chunk]) => {
          const outPath = resolve(destRenderer, fileName)
          await mkdir(dirname(outPath), { recursive: true })

          const source =
            chunk.type === "asset"
              ? (chunk.source as string | Uint8Array)
              : chunk.code!
          await writeFile(outPath, source)
        }),
      )

      console.log(`[duplicate-output] mirrored dist → ${destRoot}`)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    exposeBuildHash(),
    emitRendererManifest(),
    duplicateOutput(resolve(__dirname, "../coordinator/static"), "poc", {
      ifMissing: true,
    }),
    duplicateOutput(resolve(__dirname, "../api/data/remote"), "poc"),
  ],
  define: {
    // Replace ONLY the common dev-check. Do NOT define `process` or `process.env` globally.
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "production",
    ),
  },
  build: {
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/entry.tsx"),
      formats: ["es"],
      name: "AppRenderer",
      fileName: () => "index.[hash].js",
    },
    rollupOptions: {
      // Keep React inside bundle; no externals.
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
        entryFileNames: "index.[hash].js",
        chunkFileNames: "index.[hash].js",
        assetFileNames: "assets/[name].[hash][extname]",
      },
    },
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
  },
})
