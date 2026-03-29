import { collectFtlFiles, computeL10nHash, extractMessageIds } from "@config/l10n-config"
import react from "@vitejs/plugin-react"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { defineConfig } from "vite"

import type { AppRenderManifest } from "@common/types"
import type { Plugin } from "vite"

// Populated by emitBaselineFtl, consumed by emitRendererManifest.
const l10nBuildResult = { l10nHash: "", baselineFtlFile: "" }

/**
 * Replace all `__BUILD_HASH__` occurrences in the final JS with the real hash.
 * Matches files that look like: index.<hash>.js
 */
function exposeBuildHash(): Plugin {
  return {
    name: "expose-build-hash",
    generateBundle(_options, bundle) {
      const file = Object.keys(bundle).find(
        (k) => k.startsWith("index.") && k.endsWith(".js"),
      )
      if (!file) return
      const entry = bundle[file]
      if (entry.type !== "chunk") return
      const hash = file.match(/^index\.([^.]+)\.js$/)?.[1] ?? "dev"
      entry.code = entry.code.replaceAll("__BUILD_HASH__", hash)
    },
  }
}

/**
 * Aggregate all colocated component.ftl files, compute l10nHash from their
 * sorted message ID set, and emit the concatenated baseline FTL as an artifact.
 *
 * Runs before emitRendererManifest (normal priority vs "post") so the shared
 * l10nBuildResult is populated when the manifest is assembled.
 *
 * l10nHash is a stable identifier (keys only) so we can allow for partial gating.
 * Utilized keys must exist, but only default language is required for l10n gate
 */
function emitBaselineFtl(result: typeof l10nBuildResult): Plugin {
  return {
    name: "emit-baseline-ftl",
    async generateBundle() {
      const repoRoot = resolve(__dirname, "../..")
      const uiComponentsDir = resolve(repoRoot, "ui/components")

      const ftlPaths = await collectFtlFiles(uiComponentsDir)
      if (ftlPaths.length === 0) return

      const sources = await Promise.all(
        ftlPaths.map((p) => readFile(p, "utf-8")),
      )
      const concatenated = sources.join("\n")

      const ids = extractMessageIds(concatenated)
      const l10nHash = computeL10nHash(ids)

      const baselineFtlFile = `locales/${l10nHash}/en-US.ftl`

      this.emitFile({
        type: "asset",
        fileName: baselineFtlFile,
        source: concatenated,
      })

      result.l10nHash = l10nHash
      result.baselineFtlFile = baselineFtlFile
    },
  }
}

/**
 * Emit dist/manifest.json describing the renderer bundle.
 * For the coordinator’s server context, we point to `/renderer/<file>`.
 */
function emitRendererManifest(l10n: typeof l10nBuildResult): Plugin {
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
      const entryChunk = bundle[entryFile]

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
        l10nHash: l10n.l10nHash || undefined,
        baselineFtlFile: l10n.baselineFtlFile || undefined,
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
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
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
    emitBaselineFtl(l10nBuildResult),
    emitRendererManifest(l10nBuildResult),
    duplicateOutput(resolve(__dirname, "../coordinator/static"), "poc", { ifMissing: true }), //prettier-ignore
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
      formats: ["iife"],
      name: "AppRenderer",
      fileName: () => "index.[hash].js",
    },
    rollupOptions: {
      // Keep React inside bundle; no externals.
      output: {
        exports: "none",
        manualChunks: undefined,
        entryFileNames: "index.[hash].js",
        chunkFileNames: "index.[hash].js",
        assetFileNames: "assets/[name].[hash][extname]",
      },
    },
    target: "es2020",
    sourcemap: false,
  },
})
