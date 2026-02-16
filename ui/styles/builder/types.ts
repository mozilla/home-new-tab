export type TokenPath = ReadonlyArray<string>

export type SdToken = {
  path?: TokenPath
  value?: unknown
  original?: {
    value?: unknown
    cssProperty?: unknown
    attributes?: {
      cssProperty?: unknown
    }
  }
  attributes?: {
    cssProperty?: unknown
  }
  cssProperty?: unknown
}

export type GroupInfo = { id: string; title: string }

export type EmittedNames = Map<string, { fileId: string; path: string }>

/**
 * Arguments for {@link formatCssVars}.
 *
 * This formatter is deliberately “dumb”: it doesn’t know about your layers
 * (core/semantic/components). The caller provides:
 * - the token list for the layer
 * - a stable group ordering
 * - grouping + sorting functions
 *
 * The result is a single CSS string that:
 * - emits CSS properties first (e.g. `color-scheme`)
 * - emits CSS variables grouped + sorted for stable diffs
 * - consolidates contrast/forced-colors overrides into single media blocks
 *
 * Uniqueness:
 * - `emittedNames` is a shared map used to guard the global emitted namespace.
 *   If the same CSS property/variable name is emitted twice (even across files),
 *   we throw to avoid order-dependent cascade behavior.
 */
export type FormatCssVarsArgs = {
  /** Tokens to emit for this layer/output file (already filtered for “emittable”). */
  tokens: SdToken[]

  /** Selector that receives the variable/property declarations (usually `:root`). */
  selector: string

  /** Canonical output order of group IDs (drives section headers and stable diffs). */
  groupOrder: readonly string[]

  /** Maps a token -> `{id,title}` group used for section headers. */
  groupForToken: (token: SdToken) => GroupInfo

  /** Sort comparator used within each group to keep diffs stable. */
  compareTokens: (a: SdToken, b: SdToken) => number

  /** Destination identifier used in error messages (e.g. `core.css`). */
  fileId: string

  /** Generated banner inserted at the top of the output file. */
  header: string

  /**
   * Global duplicate-guard map.
   *
   * Intentionally shared across all outputs in a build: this build defines a
   * single “global contract” of emitted names.
   */
  emittedNames: EmittedNames
}
