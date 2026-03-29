# Code Conventions

Conventions reduce decisions. Not because rules are fun — but because thinking about the same structural questions over and over isn't.

Most of these are enforced by tooling, so they'll just happen. The rest are habits the codebase has settled into over time. Either way, they free you up to focus on the interesting parts.

## TypeScript

**`import type` for type-only imports.** Separates values from types at the import level. This is enforced by convention and keeps bundle output clean.

```typescript
import { createSyncedStore } from "../_system"

import type { SyncedStoreConfig } from "../_system/types"
import type { TimerActions, TimerData } from "./types"
```

**Union-based enums via `as const`.** The project avoids TypeScript `enum`. Instead:

```typescript
export const GridType = { FLUID: "fluid" } as const
export type GridType = (typeof GridType)[keyof typeof GridType]
```

This gives you a runtime object for lookups and a type for narrowing, without the quirks of TypeScript enums.

**Unused variables prefixed with `_`.** Enforced by ESLint — `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"`. Applies to function args, destructured arrays, caught errors, and rest siblings.

**Strict mode.** TypeScript strict is on. It catches real bugs early — nullable fields, missing returns, implicit `any`. Once you're used to it, going back feels like flying blind.

## Naming

**kebab-case** for files and folders: `discover-card/`, `timer-menu/`, `style.module.css`.

**PascalCase** for exported components: `export function DiscoverCard()`.

**camelCase** for everything else: variables, functions, store names.

## Exports

**Named exports preferred.** `export function Header()` over `export default`.

**Import boundaries follow concern boundaries.** A component or data domain exports from its own `index.tsx` — that's its public API. Don't consolidate unrelated exports into a single barrel for convenience. Each concern owns its own seam.

**Type exports separate from value exports.** Type imports appear in their own group at the bottom of the import block.

## Import ordering <Badge type="tip" text="auto-fixed" />

Enforced by `eslint-plugin-perfectionist` — this runs on save and in CI, so it's automatic.

The groups, in order:

1. **Styles** — CSS/SCSS imports (`*.css`, `*.scss`)
2. **Testing** — `@testing-library`, `vitest`, test setup/mocks
3. **External + workspace** — npm packages, then `@ui/`, `@common/`, `@config/`
4. **Relative** — parent, sibling, index imports
5. **Data** — `@data/` imports
6. **Types** — all `import type` statements

Each group is separated by a blank line. Within a group, imports are sorted naturally (alphabetical, case-insensitive).

```typescript
import style from "./style.module.css"

import { useMenuOverflow } from "../menu-overflow"
import { useDiscover } from "@data/state/discover"

import type { DiscoveryItem } from "@common/types"
```

## CSS

**Per-component modules.** Every component gets a `style.module.css`. Styles are scoped by default.

```typescript
import style from "./style.module.css"

export function Header() {
  return <div className={style.base}>...</div>
}
```

**Container queries over breakpoints.** Components respond to their own container size, not the viewport. This makes components portable.

**CSS variables for design tokens.** Spacing, typography, and colors are defined as CSS custom properties (`var(--space-medium)`). Components reference tokens, not raw values.

## Formatting <Badge type="tip" text="auto-fixed" />

Prettier handles formatting. The config is minimal:

```json
{
  "bracketSameLine": true,
  "semi": false,
  "useTabs": false,
  "tabWidth": 2
}
```

No semicolons. Two-space indentation. JSX closing brackets on the same line. Applied on save and in CI.

## Linting

ESLint with:

- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `eslint-config-prettier` to disable formatting conflicts
- `eslint-plugin-perfectionist` for import sorting
- `eslint-plugin-turbo` for env var declarations (`turbo/no-undeclared-env-vars`)
- `state-hygiene` for Zustand safety — no allocations in selectors, no mutations in setters (component config)
- `fluent-l10n` for localization — ensures `data-l10n-id` references resolve to baseline FTL keys (component config). The ESLint rule is active; the build-time FTL emission pipeline (aggregation, hashing, snapshot artifact) is [not yet wired](../architecture/l10n.md#build-pipeline).
- `stylelint` for CSS

Config files:

- `config/eslint-config/base.js` baseline config
- `config/eslint-config/component.js` component-specific (extends base)

## Documentation comments

Not every function needs a docblock. But the ones that do deserve a real one.

**When to write one.** Exported functions, types, and stores. If something appears in an `index.ts` and will be called by other parts of the codebase, document it. Skip docblocks on trivial getters, private helpers, and functions whose name already says everything.

**What to include.** Lead with what the function *enables*, not just what it does. Include the *why* when it isn't obvious: why a constraint exists, what would break without it, or how pieces fit together. Don't restate the function name in sentence form.

```typescript
// Too thin
/** Compute the l10n hash. */
function computeL10nHash(ids: string[]): string { ... }

// Right
/**
 * Compute the `l10nHash` for a set of message IDs.
 *
 * Stable across JS/CSS changes and English text edits. Only key additions
 * or removals produce a new value. That stability lets the translation
 * pipeline reuse existing translations when the key set hasn't changed.
 *
 * Pair this with `extractMessageIds` to go from raw FTL source to hash
 * in two steps, each testable on its own.
 */
function computeL10nHash(ids: string[]): string { ... }
```

**Tone.** Write like you're explaining to a capable colleague who is new to this part of the codebase. Direct and approachable. Prefer "This lets you:" over a wall of constraints. If there's something worth *not* doing with a function, say that too.

For functions with distinct phases, a numbered list pays off:

```typescript
/**
 * Run the coordinator boot sequence.
 *
 * Three phases happen in order:
 *
 * 1. **Resolve.** Renderer candidates and coordinated data are fetched in parallel.
 * 2. **SWR.** Block for fresh data if missing or stale; background-refresh if merely old.
 * 3. **Mount + cache.** Mount the renderer, then pre-cache the next bundle if needed.
 */
async function boot() { ... }
```

**Inline comments.** Use them for logic that isn't self-evident: a non-obvious constraint, a known footgun, a decision the next reader might undo without context. Don't narrate obvious code.

```typescript
// Good: explains a non-obvious ordering constraint
// Runs before emitRendererManifest (normal priority vs "post") so the shared
// l10nBuildResult is populated when the manifest is assembled.

// Not needed
// Loop over entries and write each file
await Promise.all(Object.entries(bundle).map(...))
```

## Error messages

When errors are surfaced (thrown or logged), they include context:

```typescript
// Assertions include the missing element
throw new Error("Coordinator: missing #root element")

// HTTP errors include the status
throw new Error(`${url} -> ${res.status}`)

// State errors include the storage key and reason
onError?.({
  context: "readStoredSyncFrame",
  storageKey,
  reason: "schema_mismatch",
})
```

Descriptive messages that help you find the problem without a debugger. Include the what, the where, and the why when possible.

## Work in progress

A few places where the code hasn't caught up with these conventions yet:

- The renderer entry (`clients/renderer/src/entry.tsx`) imports from `../../coordinator/src/constants` — a cross-package relative import. This is actually only relevant during this phase that we are working through core structures. This won't need to be surfaced to the renderer in future.

::: tip Convention or preference?
If tooling enforces it (ESLint, Prettier, TypeScript), it's a convention — the tooling has your back.
If it's a pattern you see repeated but not enforced, it's a preference — matching the surrounding code is the way to go.
When in doubt, `config/eslint-config/base.js` is the source of truth.
:::

## Related documentation

- [Building components](./building-components.md) — how conventions apply to component structure
- [State management](../patterns/state-management.md) — commit/set patterns, selector conventions
- [File map](../spec/file-map.md) — where config lives
- ESLint base config — `config/eslint-config/base.js`
