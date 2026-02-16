import { EmittedNames, GroupInfo, SdToken, TokenPath } from "./types"

/*
 * Shared helpers used by the Style Dictionary build pipeline.
 *
 * Design goals:
 * - Stable output: deterministic naming + sorting to keep diffs small and predictable.
 * - Tolerant inputs: token producers may vary shapes (e.g. `brand.light/dark`, `platform.default`, `{ value: ... }` shells).
 * - No surprises: avoid emitting ambiguous CSS (duplicate var/property names) and avoid "[object Object]" output.
 *
 * This file is intentionally “plumbing” code:
 * - `token/path helpers` interpret token metadata and compute consistent names.
 * - `css value serialization` turns raw token values into CSS-safe strings.
 * - `theme normalization` adapts upstream shapes into one internal representation.
 * - `grouping/ordering` defines stable sort/group rules for generated files.
 * - `guardrails` prevent invalid/ambiguous global CSS output.
 */

/**
 * Convert a string into title case for human-facing section titles.
 *
 * Notes:
 * - Used only for headers/labels, not for token identity.
 * - Keeps implementation simple and predictable rather than “smart” locale rules.
 */
export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase(),
  )
}

/**
 * Remove meta/grouping segments from a token path.
 *
 * Why:
 * - Some token graphs include nodes like `@base` which should not appear in:
 *   - CSS variable names
 *   - reference paths (`{a.b.@base}` should become `{a.b}`)
 */
export function stripSpecialKeys(pathArr: TokenPath | undefined): string[] {
  return (pathArr ?? []).filter((p) => p !== "@base")
}

/**
 * Canonical token path, suitable for naming/sorting.
 */
export function tokenPath(token: SdToken): string[] {
  return stripSpecialKeys(token.path)
}

/**
 * Root section of the token path (lowercased).
 * Example: ["Color","Gray","10"] -> "color"
 */
export function tokenRoot(token: SdToken): string {
  return String(token.path?.[0] ?? "").toLowerCase()
}

/**
 * Root + first sub-key (lowercased). Useful for coarse grouping decisions.
 */
export function tokenRootSub(token: SdToken): { root: string; sub: string } {
  const p = tokenPath(token)
  return {
    root: String(p[0] ?? "").toLowerCase(),
    sub: String(p[1] ?? "").toLowerCase(),
  }
}

/**
 * A narrow “plain object” check (excludes arrays).
 * Used heavily to avoid treating arbitrary values as objects we can introspect.
 */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
}

/* ----------------------------------------------------------------
 * Token / path helpers
 * -------------------------------------------------------------- */

/**
 * Returns a CSS property hint for tokens that represent raw CSS properties
 * (as opposed to CSS variables).
 *
 * Token producers / SD pipelines may attach this in different places depending on transforms.
 */
export function getCssPropertyHint(token: SdToken): string | null {
  const v =
    token?.cssProperty ??
    token?.attributes?.cssProperty ??
    token?.original?.cssProperty ??
    token?.original?.attributes?.cssProperty

  return typeof v === "string" && v.trim() ? v.trim() : null
}

/**
 * True if this token should be emitted as a raw CSS property (e.g. `color-scheme: ...`)
 * rather than a CSS variable.
 */
export function isCssPropertyToken(token: SdToken): boolean {
  return getCssPropertyHint(token) != null
}

/**
 * Convert a token path into a CSS variable name.
 *
 * Example:
 *   ["background","color","box","info"] -> "--background-color-box-info"
 */
export function varNameFromPath(pathArr: TokenPath | undefined): string {
  const kebab = stripSpecialKeys(pathArr)
    .join("-")
    .replaceAll("_", "-")
    .toLowerCase()

  return `--${kebab}`
}

/**
 * Convert a token into its CSS variable name using its canonical path.
 */
export function varNameFromToken(token: SdToken): string {
  return varNameFromPath(token.path)
}

/**
 * Get the “raw” token value while preserving references.
 *
 * Why:
 * - We intentionally keep refs unresolved so we can convert "{a.b.c}" into `var(--a-b-c)`
 *   ourselves, ensuring stable output and consistent naming rules.
 */
export function getTokenValue(token: SdToken): unknown {
  return token?.original?.value ?? token.value
}

/* ----------------------------------------------------------------
 * CSS value serialization
 * -------------------------------------------------------------- */

/**
 * Convert Style Dictionary curly references into CSS variable references.
 *
 * Examples:
 * - "{color.blue.10}"             -> "var(--color-blue-10)"
 * - "{background.color.box.@base}" -> "var(--background-color-box)"
 */
export function replaceCurlyRefs(input: string): string {
  return input.replaceAll(/\{([^}]+)\}/g, (_, ref: string) => {
    const cleaned = String(ref)
      .trim()
      .split(".")
      .filter((seg) => seg !== "@base")
      .join(".")

    const dashed = cleaned.replaceAll(".", "-").toLowerCase()
    return `var(--${dashed})`
  })
}

/**
 * Normalize legacy rgb()/rgba() syntax into modern CSS Color syntax.
 *
 * Why:
 * - Keeps output consistent across token sources.
 * - Plays better with modern lint rules and reduces diff noise.
 * - Stylelint made me do it ...
 *
 * Examples:
 * - rgb(1, 2, 3)      -> rgb(1 2 3)
 * - rgba(1,2,3,0.5)   -> rgb(1 2 3 / 50%)
 * - rgb(1 2 3 / 50%)  -> (unchanged)
 */
export function modernizeRgbSyntax(input: string): string {
  return input.replaceAll(/\brgba?\(\s*([^)]+?)\s*\)/g, (full, inside) => {
    // Already modern syntax (contains slash alpha)
    if (inside.includes("/")) return full

    const parts = inside.split(",").map((p: string) => p.trim())

    if (parts.length === 3) {
      return `rgb(${parts.join(" ")})`
    }

    if (parts.length === 4) {
      const [r, g, b, aRaw] = parts

      let alpha = aRaw
      const num = Number(aRaw)

      if (!Number.isNaN(num)) {
        // Convert 0–1 to percentage for modern alpha, preserve >1 as percent-ish.
        if (num <= 1) alpha = `${num * 100}%`
        else alpha = `${num}%`
      }

      return `rgb(${r} ${g} ${b} / ${alpha})`
    }

    // Unknown form, leave unchanged ... we don't to delve to deep and awaken the fire
    return full
  })
}

/**
 * Normalize a CSS string for stable output and lint friendliness.
 *
 * Current normalizations:
 * - Convert SD curly refs to `var(--...)`
 * - Convert rgb()/rgba() to modern syntax
 * - Normalize `currentColor` casing to `currentcolor` (stylelint keyword-case)
 * - Ensure `oklch()` hue has an angle unit when supplied as a bare number
 */
export function normalizeCssString(input: string): string {
  let s = replaceCurlyRefs(input)

  s = modernizeRgbSyntax(s)

  // stylelint keyword-case (CSS keywords are case-insensitive).
  s = s.replaceAll(/\bcurrentColor\b/g, "currentcolor")

  // Ensure oklch hue has a unit if supplied as a bare number.
  s = s.replaceAll(/oklch\(\s*([^)]+?)\s*\)/g, (full, inside) => {
    const parts = inside.trim().split(/\s+/)
    if (parts.length >= 3) {
      const hue = parts[2]
      const isBareNumber = /^[+-]?\d+(\.\d+)?$/.test(hue)
      const hasAngleUnit = /(deg|rad|grad|turn)$/i.test(hue)
      if (isBareNumber && !hasAngleUnit) parts[2] = `${hue}deg`
      return `oklch(${parts.join(" ")})`
    }
    return full
  })

  return s
}

/**
 * Render an unknown token value to a single CSS value string.
 *
 * Returns null for non-leaf values to avoid emitting garbage like "[object Object]".
 */
export function renderCssValue(v: unknown): string | null {
  // Primitive leaf values
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return normalizeCssString(v)

  // Some token producers nest token-like objects; unwrap one level.
  if (isPlainObject(v) && "value" in v)
    return renderCssValue((v as { value: unknown }).value)

  return null
}

/* ----------------------------------------------------------------
 * Theme object normalization (brand/value/upstream variations)
 * -------------------------------------------------------------- */

/**
 * Detect CSS sentinel values that should behave like “no value”.
 *
 * Why:
 * - Some upstream token sets use `platform.default: "unset"` (or similar)
 *   as a placeholder. Treating these as real values would emit noisy or wrong CSS.
 */
export function isCssSentinelValue(v: unknown): boolean {
  if (typeof v !== "string") return false
  const s = v.trim().toLowerCase()
  return s === "unset" || s === "initial" || s === "inherit" || s === "revert"
}

/**
 * Unwrap repeated `{ value: ... }` shells.
 *
 * Why:
 * - Token producers and transform pipelines sometimes wrap values multiple times.
 * - Centralizing this keeps downstream logic simple and consistent.
 */
export function unwrapValue(v: unknown): unknown {
  let cur: unknown = v
  while (isPlainObject(cur) && "value" in cur)
    cur = (cur as { value: unknown }).value
  return cur
}

/**
 * Normalized internal representation for a theme-capable token value.
 *
 * Notes:
 * - `light/dark` are the canonical pair for `light-dark(...)` emission.
 * - `brandDefault` supports sources that prefer `brand.default`.
 * - `platformDefault` supports sources that prefer `platform.default`.
 * - `prefersContrast/forcedColors` are collected into media blocks.
 */
export type ThemeObject = {
  light: unknown | null
  dark: unknown | null
  brandDefault: unknown | null
  platformDefault: unknown | null
  default: unknown | null
  prefersContrast: unknown | null
  forcedColors: unknown | null
}

/**
 * Normalize upstream theme/value shapes into a stable `ThemeObject`.
 *
 * Supported shapes (examples):
 * - `{ light, dark }`
 * - `{ brand: { light, dark, default } }`
 * - `{ platform: { default } }`
 * - `{ default }`
 * - plus optional `{ prefersContrast, forcedColors }`
 */
export function normalizeThemeObject(v: unknown): ThemeObject | null {
  const cur = unwrapValue(v)
  if (!isPlainObject(cur)) return null

  const brand = isPlainObject(cur.brand)
    ? (cur.brand as Record<string, unknown>)
    : null

  const light = (brand?.light ?? cur.light ?? null) as unknown | null
  const dark = (brand?.dark ?? cur.dark ?? null) as unknown | null

  const brandDefault = (brand?.default ?? null) as unknown | null
  const topDefault = (cur.default ?? null) as unknown | null

  const platformDefaultRaw =
    isPlainObject(cur.platform) &&
    (cur.platform as Record<string, unknown>).default != null
      ? (cur.platform as Record<string, unknown>).default
      : null

  // Drop sentinel placeholders like "unset".
  const platformDefault = isCssSentinelValue(platformDefaultRaw)
    ? null
    : platformDefaultRaw

  return {
    light,
    dark,
    brandDefault,
    platformDefault,
    default: topDefault,
    prefersContrast: (cur.prefersContrast ?? null) as unknown | null,
    forcedColors: (cur.forcedColors ?? null) as unknown | null,
  }
}

/**
 * Pick the primary “base” CSS value from a theme object.
 *
 * Selection order:
 * 1) If both `light` and `dark` exist -> emit `light-dark(light, dark)`
 * 2) `brand.default`
 * 3) top-level `default`
 * 4) `platform.default` (excluding sentinel values)
 * 5) fallback to a single available side (`light` or `dark`)
 */
export function pickBaseFromThemeObject(v: unknown): string | null {
  const t = normalizeThemeObject(v)
  if (!t) return null

  if (t.light != null && t.dark != null) {
    const l = renderCssValue(t.light)
    const d = renderCssValue(t.dark)
    if (l != null && d != null) return `light-dark(${l}, ${d})`
    return null
  }

  if (t.brandDefault != null) return renderCssValue(t.brandDefault)
  if (t.default != null) return renderCssValue(t.default)
  if (t.platformDefault != null) return renderCssValue(t.platformDefault)

  if (t.light != null) return renderCssValue(t.light)
  if (t.dark != null) return renderCssValue(t.dark)

  return null
}

/**
 * Decide whether a token can produce *any* meaningful CSS output.
 *
 * Why:
 * - Some nodes are structural/grouping-only.
 * - Prevents accidental emission of non-leaf objects.
 */
export function isEmittableToken(token: SdToken): boolean {
  const v = getTokenValue(token)

  // Primitive leaves
  if (typeof v === "string" || typeof v === "number") return true

  // Theme objects / semantic objects
  if (isPlainObject(v)) {
    const t = normalizeThemeObject(v)
    if (!t) return false

    const hasThemeSides = t.light != null || t.dark != null
    const hasPlatform = t.platformDefault != null
    const hasBrandDefault = t.brandDefault != null
    const hasDefault = t.default != null
    const hasOverrides = t.prefersContrast != null || t.forcedColors != null

    return (
      hasThemeSides ||
      hasPlatform ||
      hasBrandDefault ||
      hasDefault ||
      hasOverrides
    )
  }

  return false
}

/* ----------------------------------------------------------------
 * Grouping / ordering (palette)
 * -------------------------------------------------------------- */

/**
 * Determine the group header for a palette token (root "color").
 *
 * Notes:
 * - The goal is human-readable organization in output files.
 * - “Neutrals” are special-cased for readability.
 */
export function colorGroupForToken(
  token: SdToken,
  colorHueOrder: readonly string[],
): GroupInfo {
  const key = String(token.path?.[1] ?? "").toLowerCase()

  if (key === "white" || key === "black" || key === "gray" || key === "grey") {
    return { id: "neutrals", title: "Neutrals" }
  }

  if (key === "blue") return { id: "blues", title: "Blues" }
  if (key === "cyan") return { id: "cyans", title: "Cyans" }

  if (colorHueOrder.includes(key)) {
    return { id: key, title: toTitleCase(key) }
  }

  return { id: "color-other", title: "Color / Other" }
}

/**
 * Stable palette sorting: hue key, then numeric ramp when present.
 */
export function compareColorTokens(a: SdToken, b: SdToken): number {
  const aPath = stripSpecialKeys(a.path)
  const bPath = stripSpecialKeys(b.path)

  const aHue = String(aPath[1] ?? "")
  const bHue = String(bPath[1] ?? "")
  if (aHue !== bHue) return aHue.localeCompare(bHue)

  const aRamp = aPath[2]
  const bRamp = bPath[2]

  const aNum = Number(aRamp)
  const bNum = Number(bRamp)

  const aIsNum = !Number.isNaN(aNum)
  const bIsNum = !Number.isNaN(bNum)

  if (aIsNum && bIsNum) return aNum - bNum

  return String(aRamp ?? "").localeCompare(String(bRamp ?? ""))
}

/* ----------------------------------------------------------------
 * Grouping / ordering (core)
 * -------------------------------------------------------------- */

/**
 * Determine the group header for a core token.
 *
 * Rules:
 * - Tokens with `cssProperty` are placed in "Other" (emitted as raw properties, not vars).
 * - Root "color" uses palette grouping.
 * - Root "zindex" is given a nicer title.
 * - Otherwise, `coreGroupOrder` drives ordering; unknown roots fall into "Other".
 */
export function coreGroupForToken(
  token: SdToken,
  coreGroupOrder: readonly string[],
  colorHueOrder: readonly string[],
): GroupInfo {
  const root = tokenRoot(token)

  if (isCssPropertyToken(token)) return { id: "other", title: "Other" }

  if (root === "color") return colorGroupForToken(token, colorHueOrder)
  if (root === "zindex") return { id: "zindex", title: "Z-Index" }

  if (coreGroupOrder.includes(root))
    return { id: root, title: toTitleCase(root) }

  return { id: "other", title: "Other" }
}

/**
 * Stable core sorting:
 * - Palette tokens get palette sort.
 * - Everything else sorts by normalized path key.
 */
export function compareCoreTokens(a: SdToken, b: SdToken): number {
  const aRoot = tokenRoot(a)
  const bRoot = tokenRoot(b)

  if (aRoot === "color" && bRoot === "color") return compareColorTokens(a, b)

  const aKey = stripSpecialKeys(a.path).join(".")
  const bKey = stripSpecialKeys(b.path).join(".")
  return aKey.localeCompare(bKey)
}

/* ----------------------------------------------------------------
 * Grouping / ordering (semantic)
 * -------------------------------------------------------------- */

/**
 * Determine group header for semantic-layer tokens.
 * A couple roots get nicer display names, otherwise order is controlled by `semanticGroupOrder`.
 */
export function semanticGroupForToken(
  token: SdToken,
  semanticGroupOrder: readonly string[],
): GroupInfo {
  const root = tokenRoot(token)

  if (root === "box") return { id: "box", title: "Box Shadow" }

  if (semanticGroupOrder.includes(root))
    return { id: root, title: toTitleCase(root) }

  return { id: "other", title: "Other" }
}

/**
 * Stable semantic sorting by normalized path key.
 */
export function compareSemanticTokens(a: SdToken, b: SdToken): number {
  const aKey = stripSpecialKeys(a.path).join(".")
  const bKey = stripSpecialKeys(b.path).join(".")
  return aKey.localeCompare(bKey)
}

/* ----------------------------------------------------------------
 * Grouping / ordering (components)
 * -------------------------------------------------------------- */

/**
 * Determine group header for component-layer tokens.
 *
 * Strategy:
 * - Group by `${root}/${sub}` when explicitly ordered in `componentGroupOrder`.
 * - Otherwise, if we recognize the root, bucket into `${root}/other`.
 * - Unknown roots fall into "Other".
 */
export function componentGroupForToken(
  token: SdToken,
  componentGroupOrder: readonly string[],
  componentRoots: ReadonlySet<string>,
): GroupInfo {
  const p = stripSpecialKeys(token.path)
  const root = String(p[0] ?? "").toLowerCase()
  const sub = String(p[1] ?? "other").toLowerCase()

  const id = `${root}/${sub}`
  if (componentGroupOrder.includes(id)) {
    return { id, title: `${toTitleCase(root)} / ${toTitleCase(sub)}` }
  }

  if (componentRoots.has(root)) {
    return { id: `${root}/other`, title: `${toTitleCase(root)} / Other` }
  }

  return { id: "other", title: "Other" }
}

/**
 * Stable component sorting by normalized path key.
 */
export function compareComponentTokens(a: SdToken, b: SdToken): number {
  const aKey = stripSpecialKeys(a.path).join(".")
  const bKey = stripSpecialKeys(b.path).join(".")
  return aKey.localeCompare(bKey)
}

/* ----------------------------------------------------------------
 * Overrides (prefers-contrast / forced-colors)
 * -------------------------------------------------------------- */

/**
 * Collect override values for a given override key across tokens.
 *
 * Output shape matches what emitters typically need:
 * - `{ name: "--foo-bar", value: "..." }`
 *
 * Notes:
 * - Raw CSS-property tokens are intentionally excluded from override media blocks.
 * - Values are rendered via `renderCssValue` to ensure consistent normalization.
 */
export function collectOverrides(
  tokens: readonly SdToken[],
  key: "prefersContrast" | "forcedColors",
) {
  const out: Array<{ name: string; value: string }> = []

  for (const token of tokens) {
    if (isCssPropertyToken(token)) continue

    const v = getTokenValue(token)
    if (!isPlainObject(v)) continue

    const t = normalizeThemeObject(v)
    if (!t) continue

    const raw = t[key]
    if (raw == null) continue

    const rendered = renderCssValue(raw)
    if (rendered != null)
      out.push({ name: varNameFromToken(token), value: rendered })
  }

  return out
}

/* ----------------------------------------------------------------
 * Output guardrails (duplicate definitions)
 * -------------------------------------------------------------- */

/**
 * Enforce globally-unique emitted identifiers across generated CSS.
 *
 * Why this exists:
 * - Duplicate CSS variable/property names create order-dependent output across files.
 * - That leads to “works on my machine” bugs and non-deterministic diffs.
 *
 * This is a deliberate “fail fast” guardrail: duplicates are treated as build errors.
 */
export function trackEmittedName(args: {
  kind: "var" | "property"
  /** Emitted identifier: "--foo-bar" or "color-scheme" */
  name: string
  /** Destination file used for debugging ("core.css", etc.) */
  fileId: string
  token?: SdToken
  emittedNames: EmittedNames
}) {
  const { kind, name, fileId, token, emittedNames } = args

  // Defensive: avoids confusing "property:null" keys.
  if (typeof name !== "string" || !name.trim()) return

  const key = `${kind}:${name}`
  const prev = emittedNames.get(key)
  if (!prev) {
    emittedNames.set(key, { fileId, path: (token?.path || []).join(".") })
    return
  }

  const prevWhere = `${prev.fileId} (${prev.path || "unknown"})`
  const nextWhere = `${fileId} (${(token?.path || []).join(".") || "unknown"})`

  throw new Error(
    `Duplicate ${kind} emitted into the global CSS namespace: "${name}".\n` +
      `- First: ${prevWhere}\n` +
      `- Next:  ${nextWhere}\n` +
      `This would create ambiguous cascade/order dependence across generated files.\n` +
      `Rename or de-duplicate the token so each emitted name is globally unique.`,
  )
}

/* ----------------------------------------------------------------
 * Layer routing
 * -------------------------------------------------------------- */

/**
 * True if a token belongs to the core layer.
 *
 * Notes:
 * - Core owns all tokens whose root is in `coreRoots`.
 * - Core also owns raw `cssProperty` tokens (global runtime properties).
 */
export function isCoreToken(
  token: SdToken,
  coreRoots: ReadonlySet<string>,
): boolean {
  const root = tokenRoot(token)
  return coreRoots.has(root) || isCssPropertyToken(token)
}

/**
 * True if a token belongs to the semantic layer.
 */
export function isSemanticLayerToken(
  token: SdToken,
  semanticRoots: ReadonlySet<string>,
): boolean {
  return semanticRoots.has(tokenRoot(token))
}

/**
 * True if a token belongs to the component layer.
 */
export function isComponentToken(
  token: SdToken,
  componentRoots: ReadonlySet<string>,
): boolean {
  return componentRoots.has(tokenRoot(token))
}
