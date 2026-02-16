import {
  collectOverrides,
  getCssPropertyHint,
  getTokenValue,
  isCssPropertyToken,
  isPlainObject,
  pickBaseFromThemeObject,
  renderCssValue,
  stripSpecialKeys,
  trackEmittedName,
  varNameFromToken,
} from "./sd.utilities"

import type { FormatCssVarsArgs, SdToken } from "./types"

/**
 * formatCssVars
 * ---
 * Shared CSS formatter used by all Style Dictionary layers.
 *
 * Responsibilities:
 * 1) Emit raw CSS properties first (tokens with a `cssProperty` hint).
 * 2) Emit CSS variables grouped into sections in the order provided by the caller.
 * 3) Consolidate overrides:
 *    - prefers-contrast: more
 *    - forced-colors: active
 *
 * Non-responsibilities:
 * - Routing tokens into layers (core/semantic/components). The caller filters.
 * - Defining group order. The caller supplies `groupOrder`.
 * - Knowing token semantics. All token interpretation lives in `sd.utilities`.
 */
export function formatCssVars({
  tokens,
  selector,
  groupOrder,
  groupForToken,
  compareTokens,
  fileId,
  header,
  emittedNames,
}: FormatCssVarsArgs): string {
  // Overrides are gathered into single blocks to avoid scattered media queries.
  const prefersContrast = collectOverrides(tokens, "prefersContrast")
  const forcedColors = collectOverrides(tokens, "forcedColors")

  const lines: string[] = []
  lines.push(header)
  lines.push(`${selector} {`)

  /* -------------------------------------------------------------------------------------------------
   * 1) Raw CSS properties (e.g. color-scheme)
   * ------------------------------------------------------------------------------------------------- */

  // Emit CSS properties first so they don’t get lumped into “Other” group sections.
  const propTokens = tokens.filter(isCssPropertyToken)

  if (propTokens.length > 0) {
    // Stable ordering by token path for predictable diffs.
    propTokens.sort((a, b) =>
      stripSpecialKeys(a.path)
        .join(".")
        .localeCompare(stripSpecialKeys(b.path).join(".")),
    )

    lines.push(`  /** CSS Properties **/`)

    for (const token of propTokens) {
      const v = getTokenValue(token)

      // Resolve the “base” value:
      // - primitives: string/number
      // - theme objects: light/dark/default/platform defaults, etc.
      let base: string | null = null
      if (typeof v === "string" || typeof v === "number") {
        base = renderCssValue(v)
      } else if (isPlainObject(v)) {
        base = pickBaseFromThemeObject(v)
      }

      if (base == null) continue

      const cssProp = getCssPropertyHint(token)
      if (!cssProp) continue

      // Enforce global uniqueness of emitted names.
      trackEmittedName({
        kind: "property",
        name: cssProp,
        fileId,
        token,
        emittedNames,
      })

      lines.push(`  ${cssProp}: ${base};`)
    }

    lines.push("")
  }

  /* -------------------------------------------------------------------------------------------------
   * 2) CSS variables grouped into sections
   * ------------------------------------------------------------------------------------------------- */

  // Group tokens (excluding raw CSS properties) using caller-defined grouping rules.
  const groups = new Map<string, { title: string; tokens: SdToken[] }>()

  for (const token of tokens) {
    if (isCssPropertyToken(token)) continue

    const g = groupForToken(token)
    const entry = groups.get(g.id) ?? { title: g.title, tokens: [] }

    entry.tokens.push(token)
    groups.set(g.id, entry)
  }

  // Sort within groups for stable output.
  for (const g of groups.values()) g.tokens.sort(compareTokens)

  // Insert blank line between sections, but only once something has been emitted.
  let firstGroupEmitted = propTokens.length > 0

  for (const groupId of groupOrder) {
    const group = groups.get(groupId)
    if (!group || group.tokens.length === 0) continue

    if (firstGroupEmitted) lines.push("")
    firstGroupEmitted = true

    lines.push(`  /** ${group.title} **/`)

    for (const token of group.tokens) {
      const v = getTokenValue(token)

      let base: string | null = null
      if (typeof v === "string" || typeof v === "number") {
        base = renderCssValue(v)
      } else if (isPlainObject(v)) {
        base = pickBaseFromThemeObject(v)
      }

      if (base == null) continue

      const varName = varNameFromToken(token)

      // Enforce global uniqueness of emitted names.
      trackEmittedName({
        kind: "var",
        name: varName,
        fileId,
        token,
        emittedNames,
      })

      lines.push(`  ${varName}: ${base};`)
    }
  }

  lines.push(`}`)
  lines.push("")

  /* -------------------------------------------------------------------------------------------------
   * 3) Consolidated overrides (media queries)
   * ------------------------------------------------------------------------------------------------- */

  if (prefersContrast.length > 0) {
    lines.push(`@media (prefers-contrast: more) {`)
    lines.push(`  ${selector} {`)
    for (const o of prefersContrast) lines.push(`    ${o.name}: ${o.value};`)
    lines.push(`  }`)
    lines.push(`}`)
    lines.push("")
  }

  if (forcedColors.length > 0) {
    lines.push(`@media (forced-colors: active) {`)
    lines.push(`  ${selector} {`)
    for (const o of forcedColors) lines.push(`    ${o.name}: ${o.value};`)
    lines.push(`  }`)
    lines.push(`}`)
    lines.push("")
  }

  return lines.join("\n")
}
