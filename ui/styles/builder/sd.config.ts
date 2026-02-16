import StyleDictionary from "style-dictionary"
import { formatCssVars } from "./sd.format"
import {
  compareComponentTokens,
  compareCoreTokens,
  compareSemanticTokens,
  componentGroupForToken,
  coreGroupForToken,
  isComponentToken,
  isCoreToken,
  isEmittableToken,
  isSemanticLayerToken,
  semanticGroupForToken,
} from "./sd.utilities"

import type { EmittedNames, SdToken } from "./types"

/**
 * Style Dictionary config (3-layer CSS output).
 *
 * Inputs:
 * - Reads JSON tokens from `./tokens`
 *
 * Outputs:
 * - `./css/core.css`       → foundation primitives (palette + scales + globals)
 * - `./css/semantics.css`  → semantic intent (background/text/border/etc.)
 * - `./css/components.css` → build in component usage (button/input/etc.)
 *
 * Editing guide:
 * 1) Start with the routing sets (`*_ROOTS`) to decide what layer owns a token root.
 * 2) Then adjust the corresponding `*_GROUP_ORDER` to control emitted CSS ordering.
 * 3) Grouping functions live in `sd.utilities` and should remain “dumb + pure”.
 *
 * Invariants:
 * - Output ordering should be stable (avoid accidental churn in diffs).
 * - Token values may contain `{ref.paths}`; those are intentionally preserved upstream
 *   and converted to `var(--...)` by our formatter pipeline.
 * - Duplicate emitted variable/property names are treated as errors (guarded by
 *   `EMITTED_NAMES` per output file) to avoid CSS cascade ambiguity. It get's called
 *   out by the build step.
 */

/**
 * Root-level routing: which token "root" belongs to which file / concept.
 * Trying to keep this clean.  Because ordering isn't 1:1 we have to define two
 * things.  This section is not concerned with output order, only file ownership
 */
const CORE_ROOTS = new Set(["color", "space", "size", "font", "zindex"])

const SEMANTIC_ROOTS = new Set([
  "attention",
  "background",
  "text",
  "border",
  "icon",
  "shadow",
  "surface",
  "overlay",
  "focus",
  "outline",
  "box",
])

const COMPONENT_ROOTS = new Set([
  "button",
  "input",
  "checkbox",
  "link",
  "table",
])

/**
 * Grouping: What order to these selectors show up in the files.  It makes the files
 * easier to scan.  We could potentially just YOLO things in here since it is all
 * generated ... BUT ... we want to still be able to explore. ADVENTURE IS OUT THERE!
 */

/** Keeps our colors in neat piles */
const COLOR_HUE_ORDER = [
  "neutrals",
  "blues",
  "cyans",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "violet",
  "yellow",
  "accent",
  "color-other",
  "other",
] as const

/** Group ordering for `core.css` — base level variables */
const CORE_GROUP_ORDER = [
  ...COLOR_HUE_ORDER,
  "space",
  "size",
  "font",
  "zindex",
  "border",
  "container",
  "heading",
  "other",
] as const

/** Stable group ordering for `semantics.css` — base, active, etc.
 * More of a what is this role.  That way we don't spread our core base values
 * around the implementations... which would make all this less effective
 */
const SEMANTIC_GROUP_ORDER = [
  "attention",
  "background",
  "text",
  "border",
  "icon",
  "shadow",
  "surface",
  "overlay",
  "focus",
  "outline",
  "box",
  "other",
] as const

/** Stable group ordering for `components.css` — a bit of a misnomer, but here we
 * are. These are not the components we are building, they are core components, like
 * a button, and input, etc.  It also has a little baseline standards like container
 */
const COMPONENT_GROUP_ORDER = [
  "button/background",
  "button/border",
  "button/text",
  "button/font",
  "button/icon",
  "button/size",
  "button/padding",
  "button/opacity",
  "button/min",
  "button/other",
  "input/other",
  "checkbox/other",
  "link/other",
  "table/other",
  "container",
  "heading",
  "other",
] as const

/** Banner inserted at the top of each generated CSS file */
const GENERATED_HEADER = [
  "/**",
  " * -----------------------------------------------------------------",
  " * Generated file — Here be Dragons ... edits will be overwritten.",
  " * Update newtab-tokens if you must (try not to) or the SD config for core.",
  " * NOTE: design-tokens come from upstream and should also not be modified here.",
  " * -----------------------------------------------------------------",
  " */",
  "",
].join("\n")

/**
 * Duplicate-guard state for a single output file. If two tokens emit the same
 * CSS variable/property name, the cascade becomes ambiguous (read borked). This
 * is a real "Why did everything break?!?" vector.  To that end, we treat that
 * as a build-time error rather than silently “last one wins”.
 */
const EMITTED_NAMES: EmittedNames = new Map()

/**
 * Bind “pure” helpers (from `sd.utilities`) to the local constants above.
 *
 * This keeps the `registerFormat(...)` blocks short and readable without pushing
 * config constants down into utility code.
 */
const isCore = (t: SdToken) => isCoreToken(t, CORE_ROOTS)
const isSemantic = (t: SdToken) => isSemanticLayerToken(t, SEMANTIC_ROOTS)
const isComponent = (t: SdToken) => isComponentToken(t, COMPONENT_ROOTS)

const coreGroup = (t: SdToken) =>
  coreGroupForToken(t, CORE_GROUP_ORDER, COLOR_HUE_ORDER)

const semanticGroup = (t: SdToken) =>
  semanticGroupForToken(t, SEMANTIC_GROUP_ORDER)

const componentGroup = (t: SdToken) =>
  componentGroupForToken(t, COMPONENT_GROUP_ORDER, COMPONENT_ROOTS)

/**
 * Shared format wrapper. This let's us reduce a bit of duplication through our
 * formatters.  They become more config shape and less repetitive function shaped.
 *
 * The flow:
 * - clear duplicate tracking per output file ()
 * - select tokens for the layer (routing + emittable guard)
 * - delegate the actual CSS emission to `formatCssVars`
 */
function registerLayerFormat(args: {
  name: "css/core" | "css/semantic" | "css/components"
  defaultFileId: string
  isInLayer: (t: SdToken) => boolean
  groupOrder: readonly string[]
  groupForToken: (t: SdToken) => { id: string; title: string }
  compareTokens: (a: SdToken, b: SdToken) => number
}) {
  StyleDictionary.registerFormat({
    name: args.name,
    format: ({ dictionary, options, file }) => {
      /** If we ever want to do more interesting bundling SPOILER: we don't
       * we could `EMITTED_NAMES.clear() here... so it clears per file.
       * But since this is meant to be a global baseline, I will just leave this
       * here as a thought.
       */

      const selector = options?.selector ?? ":root"
      const all = dictionary.allTokens.slice() as SdToken[]

      const tokens = all.filter((t) => args.isInLayer(t) && isEmittableToken(t))

      return formatCssVars({
        tokens,
        selector,
        groupOrder: args.groupOrder,
        groupForToken: args.groupForToken,
        compareTokens: args.compareTokens,
        fileId: file?.destination ?? args.defaultFileId,
        header: GENERATED_HEADER,
        emittedNames: EMITTED_NAMES,
      })
    },
  })
}

/**
 * Register our formats.  This is where we are defining the guidelines for
 * style-dictionary to parse everything out into actual css.  As this is all
 * really just a configuration builder, we are using our helper above to
 * set up the specific files
 *
 * - Core: baseline values
 * - Semantics: semantic values ... shocking I know
 * - Components: built in component level values
 */
registerLayerFormat({
  name: "css/core",
  defaultFileId: "core.css",
  isInLayer: isCore,
  groupOrder: CORE_GROUP_ORDER,
  groupForToken: coreGroup,
  compareTokens: compareCoreTokens,
})

registerLayerFormat({
  name: "css/semantic",
  defaultFileId: "semantics.css",
  isInLayer: isSemantic,
  groupOrder: SEMANTIC_GROUP_ORDER,
  groupForToken: semanticGroup,
  compareTokens: compareSemanticTokens,
})

registerLayerFormat({
  name: "css/components",
  defaultFileId: "components.css",
  isInLayer: isComponent,
  groupOrder: COMPONENT_GROUP_ORDER,
  groupForToken: componentGroup,
  compareTokens: compareComponentTokens,
})

/**
 * This is our final config that we can pass to the style-dictionary builder.
 */
export default {
  source: ["./tokens/**/*.json"],
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: "./css",
      files: [
        {
          destination: "core.css",
          format: "css/core",
          options: { selector: ":root" },
        },
        {
          destination: "semantics.css",
          format: "css/semantic",
          options: { selector: ":root" },
        },
        {
          destination: "components.css",
          format: "css/components",
          options: { selector: ":root" },
        },
      ],
    },
  },
}
