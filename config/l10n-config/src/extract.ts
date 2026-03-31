/**
 * Post-build script: extracts source FTL files and produces a translation manifest.
 *
 * Prerequisite: the renderer must be built first (reads manifest.json from dist).
 *
 * Usage:
 *   pnpm --filter @config/l10n-config l10n:extract
 *
 * Output:
 *   clients/renderer/dist/l10n/<l10nHash>/components/translation-manifest.json
 *   clients/renderer/dist/l10n/<l10nHash>/components/<component-path>/component.ftl
 */

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { buildTranslationManifest } from "./utilities/translation-manifest"

// Local subset of AppRenderManifest — only the fields this script needs.
type RendererManifest = {
  hash: string
  l10nHash?: string
}

// Anchored to import.meta.url rather than process.cwd() — stable regardless of where the script is invoked from.
const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
)
const distDir = path.join(workspaceRoot, "clients/renderer/dist")
const uiComponentsDir = path.join(workspaceRoot, "ui/components")

/**
 * Extract source FTL files and write the translation manifest to dist.
 *
 * Three phases run in order:
 *
 * 1. **Read.** Load manifest.json from the renderer dist to get the snapshot and l10n hashes.
 * 2. **Build.** Scan ui/components/ for component.ftl files and assemble the translation manifest.
 * 3. **Emit.** Copy each component.ftl into dist and write translation-manifest.json.
 */
async function run(): Promise<void> {
  const manifestPath = path.join(distDir, "manifest.json")

  let rendererManifest: RendererManifest
  try {
    const raw = await readFile(manifestPath, "utf-8")
    rendererManifest = JSON.parse(raw) as RendererManifest
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(
        `manifest.json not found at ${manifestPath} — run the renderer build first`,
      )
    } else {
      console.error(`Failed to read manifest.json: ${String(err)}`)
    }
    process.exit(1)
  }

  if (!rendererManifest.hash || !rendererManifest.l10nHash) {
    console.error(
      "manifest.json is missing hash or l10nHash — the build may be incomplete",
    )
    process.exit(1)
  }

  const translationManifest = await buildTranslationManifest({
    snapshotHash: rendererManifest.hash,
    l10nHash: rendererManifest.l10nHash,
    uiComponentsDir,
  })

  // Destination for the translation handoff: dist/l10n/<l10nHash>/components/
  // l10nHash keys the directory so translations can be matched against the correct key set.
  const sourceDir = path.join(
    distDir,
    "l10n",
    rendererManifest.l10nHash,
    "components",
  )

  for (const component of translationManifest.components) {
    const srcFtl = path.join(uiComponentsDir, component.path, "component.ftl")
    const destFtl = path.join(sourceDir, component.path, "component.ftl")
    await mkdir(path.dirname(destFtl), { recursive: true })
    await copyFile(srcFtl, destFtl)
  }

  await writeFile(
    path.join(sourceDir, "translation-manifest.json"),
    JSON.stringify(translationManifest, null, 2),
  )

  console.log(`Extracted to ${path.dirname(sourceDir)}`)
}

run()
