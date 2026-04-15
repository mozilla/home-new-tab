import {
  collectFtlFiles,
  computeL10nHash,
  extractMessageIds,
} from "@config/l10n-config"
import react from "@vitejs/plugin-react"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { defineConfig } from "vite"

import type { AppRenderManifest, ValidationFailure } from "@common/types"
import type { Plugin } from "vite"

// Populated by emitBaselineFtl, consumed by emitRendererManifest.
const l10nBuildResult = { l10nHash: "", baselineFtlFile: "" }

// Populated by emitDataSchema, consumed by emitRendererManifest.
const schemaBuildResult = { schemaFile: "" }

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
 * Emit the renderer's data-schema.json as a build artifact.
 *
 * The coordinator fetches this file from the renderer bundle URL at boot to
 * discover which data sources to fetch and how to cache them. Schema is a
 * required renderer artifact — the coordinator has no fallback domain knowledge.
 */
function emitDataSchema(result: typeof schemaBuildResult): Plugin {
  return {
    name: "emit-data-schema",
    async generateBundle() {
      const schemaPath = resolve(__dirname, "src/data-schema.json")
      const source = await readFile(schemaPath, "utf-8")
      const schemaFile = "data-schema.json"
      this.emitFile({ type: "asset", fileName: schemaFile, source })
      result.schemaFile = schemaFile
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

      const baselineFtlFile = `l10n/${l10nHash}/en-US.ftl`

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
function emitRendererManifest(l10n: typeof l10nBuildResult, schema: typeof schemaBuildResult): Plugin {
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
        schemaFile: schema.schemaFile || undefined,
      }

      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifest, null, 2),
      })
    },
  }
}

function formatValidationFailures(failures: ValidationFailure[]): string {
  const R = "\x1b[31;1m" // bold red
  const r = "\x1b[31m" // red
  const X = "\x1b[0m" // reset
  const count = failures.length
  const lines = failures.map(
    (failure, i) =>
      `  ${i + 1}. ${r}[${failure.layer}/${failure.rule}]${X}${failure.artifact ? ` (${failure.artifact})` : ""}\n     ${failure.message}`,
  )
  return (
    `\n${R}[validate-renderer-snapshot] ${count} validation failure${count === 1 ? "" : "s"}:${X}\n\n` +
    lines.join("\n\n") +
    "\n"
  )
}

/**
 * Run structural, identity, and policy validation against the assembled bundle.
 * Collects all failures before reporting — does not short-circuit on the first.
 * Runs before duplicateOutput so invalid artifacts are never mirrored.
 */
function validateRendererSnapshot(l10n: typeof l10nBuildResult): Plugin {
  return {
    name: "validate-renderer-snapshot",
    enforce: "post",
    generateBundle(_options, bundle) {
      const failures: ValidationFailure[] = []
      const keys = Object.keys(bundle)

      // Structural: JS entry
      const jsEntry = keys.find(
        (k) => k.startsWith("index.") && k.endsWith(".js"),
      )
      if (!jsEntry) {
        failures.push({
          layer: "structural",
          rule: "missing_artifact",
          message:
            "No JS entry chunk found in bundle. Expected a file matching index.*.js.",
        })
      }

      // Structural: CSS
      const cssFile = keys.find(
        (k) => k.endsWith(".css") && !k.endsWith(".css.map"),
      )
      if (!cssFile) {
        failures.push({
          layer: "structural",
          rule: "missing_artifact",
          message:
            "No CSS artifact found in bundle. Expected at least one .css file (excluding source maps).",
        })
      }

      // Structural: data schema emitted
      const schemaArtifact = keys.find((k) => k === "data-schema.json")
      if (!schemaArtifact) {
        failures.push({
          layer: "structural",
          rule: "missing_artifact",
          message:
            "No data-schema.json found in bundle. The data schema is a universally required renderer artifact — the coordinator has no fallback domain knowledge.",
        })
      }

      // Structural: baseline FTL emitted
      if (!l10n.baselineFtlFile) {
        failures.push({
          layer: "structural",
          rule: "missing_artifact",
          message:
            "Baseline FTL was not emitted. emitBaselineFtl produced no output (baselineFtlFile is empty).",
        })
      }

      // Identity: l10nHash absent despite FTL present
      if (l10n.baselineFtlFile && !l10n.l10nHash) {
        failures.push({
          layer: "identity",
          rule: "missing_identity_input",
          message:
            "Baseline FTL was emitted but l10nHash is absent. The FTL key-set hash must be included in snapshot identity.",
          artifact: l10n.baselineFtlFile,
        })
      }

      // Identity: unstable JS hash
      if (jsEntry) {
        const hash = jsEntry.match(/^index\.([^.]+)\.js$/)?.[1]
        if (hash === "dev" || hash === undefined) {
          failures.push({
            layer: "identity",
            rule: "unstable_identity",
            message: `JS entry filename did not yield a stable content hash. Got fallback value "dev" from "${jsEntry}".`,
            artifact: jsEntry,
            detail: { extracted: hash ?? null },
          })
        }
      }

      // Policy: baseline locale is en-US
      if (l10n.baselineFtlFile && !l10n.baselineFtlFile.includes("en-US")) {
        failures.push({
          layer: "policy",
          rule: "missing_baseline_locale",
          message: `Baseline FTL path does not include the required "en-US" locale segment. Got: "${l10n.baselineFtlFile}".`,
          artifact: l10n.baselineFtlFile,
        })
      }

      if (failures.length > 0) {
        console.error(formatValidationFailures(failures))
        process.exit(1)
      }
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
    emitDataSchema(schemaBuildResult),
    emitRendererManifest(l10nBuildResult, schemaBuildResult),
    validateRendererSnapshot(l10nBuildResult),
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
