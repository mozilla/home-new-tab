import { readFile } from "node:fs/promises"
import path from "node:path"

import { collectFtlFiles, extractMessageIds } from "./fluent-utils"

/**
 * The outbound boundary between the build pipeline and the translation pipeline.
 *
 * Produced after a renderer build and sent to the translation repository.
 * The translation pipeline uses this manifest to:
 *
 * - identify which keys are new (for queuing translation work)
 * - carry forward existing translations for unchanged keys
 * - track per-component granularity for targeted translation updates
 */
export type TranslationManifest = {
  /** JS content hash of the snapshot this manifest was produced from. */
  snapshotHash: string

  /**
   * Key-set hash. Translations are keyed to this, not snapshotHash.
   *
   * Stable across JS/CSS changes and English text edits — only key
   * additions or removals produce a new value.
   */
  l10nHash: string

  /** Baseline locale. Always "en-US". */
  baselineLocale: "en-US"

  /** Total number of translatable keys across all components. */
  keyCount: number

  /** Globally sorted list of all message IDs in the baseline. */
  keys: string[]

  /** Per-component breakdown for granular translation tracking. */
  components: Array<{
    /** Component path relative to the ui/components root. */
    path: string
    /** Message IDs contributed by this component, sorted. */
    keys: string[]
  }>
}

/**
 * Build a TranslationManifest from the colocated component FTL files.
 *
 * The `snapshotHash` and `l10nHash` parameters come from the already-built
 * `manifest.json` — this function describes what was built, it does not
 * re-derive identity independently.
 *
 * Example:
 *
 *   const manifest = await buildTranslationManifest({
 *     snapshotHash: rendererManifest.hash,
 *     l10nHash: rendererManifest.l10nHash,
 *     uiComponentsDir: "/repo/ui/components",
 *   })
 */
export async function buildTranslationManifest(params: {
  snapshotHash: string
  l10nHash: string
  uiComponentsDir: string
}): Promise<TranslationManifest> {
  const { snapshotHash, l10nHash, uiComponentsDir } = params

  const ftlPaths = await collectFtlFiles(uiComponentsDir)

  const components = await Promise.all(
    ftlPaths.map(async (ftlPath) => {
      const source = await readFile(ftlPath, "utf-8")
      const keys = extractMessageIds(source)
      const componentPath = path.relative(
        uiComponentsDir,
        path.dirname(ftlPath),
      )
      return { path: componentPath, keys }
    }),
  )

  const keys = components.flatMap((c) => c.keys).sort()

  return {
    snapshotHash,
    l10nHash,
    baselineLocale: "en-US",
    keyCount: keys.length,
    keys,
    components,
  }
}
