# Building Components

Components are presentational. They render UI and manage their own interaction state (hover, focus, open/closed), but they don't fetch data or contain business logic. That responsibility lives in state stores (`data/state/`) and the coordinator.

## Component structure

Each component lives in a kebab-case folder under `ui/components/`:

```
timer/
├── index.tsx              # Component (named export)
├── component.ftl          # Localization resource (en-US baseline)
├── component.test.tsx     # Vitest + testing-library tests
├── component.story.tsx    # Storybook story
├── style.module.css       # Scoped styles
└── hooks/                 # Optional: colocated hooks for derived display values
```

A minimal component looks like this:

```typescript
import style from "./style.module.css"

export function Header() {
  return (
    <div className={style.base} data-testid="header">
      {/* ... */}
    </div>
  )
}
```

Key patterns:

- **Named exports**, `export function Timer()`, not `export default`
- **`data-testid`** on every component, used by tests
- **CSS module import first**, style import is always the first line
- **No business logic**, if you're reaching for `fetch` or complex conditional logic, it probably belongs in `data/state/`

The `_base/` directory holds shared decorators that multiple components use.

## State access

Components consume state through Zustand hooks with selectors:

```typescript
import { useTimer } from "@data/state/timer"

export function TimerDisplay() {
  const status = useTimer((s) => s.data.status)
  const start = useTimer((s) => s.actions.start)

  return <button onClick={start}>{status}</button>
}
```

What makes this work well:

- **Selectors keep re-renders tight.** `useTimer((s) => s.data.status)` re-renders only when `status` changes. `useTimer()` re-renders on every store update. That's the difference.
- **Narrow selectors for data and actions.** Pick what you need, leave the rest.
- **Package aliases for imports.** `@data/state/timer` reads better and won't break when things move around, unlike `../../../data/state/timer`.

For more on how stores work: [State management](../patterns/state-management.md).

## CSS Modules

Every component gets a `style.module.css`. CSS Modules scope class names to the component at build time, so two components can both define `.base` without colliding. Each gets a unique hash in the output. You import the module and reference classes as properties:

```typescript
import style from "./style.module.css"

export function Timer() {
  return <div className={style.base}>...</div>
}
```

The module boundary is the isolation mechanism. Styles in one component's module cannot leak into another's. No global namespace, no BEM prefixing. The tooling handles it.

### Nesting

Native CSS nesting keeps related styles together under `.base` instead of scattering them across the file. Use `&` for pseudo-states and pseudo-elements, and nest child classes directly:

```css
.base {
  display: grid;
  container-type: inline-size;
  gap: var(--space-medium);

  &:hover {
    box-shadow: var(--box-shadow-card-hover);
  }

  .inner {
    padding: var(--space-medium);
  }
}
```

Nesting reflects the DOM structure. If a class is visually or structurally a child of `.base`, nest it. This keeps the relationship explicit and avoids flat lists of disconnected selectors.

Not everything needs to live under `.base`. Define additional top-level classes when a part of the component has its own layout concerns or doesn't share a container relationship with `.base`. `.base` gets you started with a reasonable root container, not a cage.

### Key patterns

- **Container queries** for responsive behavior, components respond to their own size, not the viewport
- **CSS variables** for design tokens, `var(--space-medium)`, not `16px`
- **`.base`** as the root class name, consistent entry point for every component's styles

Global styles and design tokens live in `ui/styles/`.

## Localization

Each component that renders user-visible text gets a `component.ftl` file in the same directory. This is the en-US baseline, the only locale authored in this repo.

```ftl
# component.ftl
timer-start-label = Start
timer-pause-label = Pause
timer-elapsed = { $minutes } min elapsed
```

Components reference message IDs via `data-l10n-id` attributes:

```tsx
<button data-l10n-id="timer-start-label" />
```

The ESLint plugin (`no-missing-message`) validates that every `data-l10n-id` in a component resolves to a key in its colocated FTL. You'll get editor feedback immediately if a key is missing.

At build time, all `component.ftl` files are aggregated into a single baseline artifact for the snapshot. Non-baseline translations are produced externally. For the full pipeline: [Localization](../architecture/l10n.md).

## Storybook

Each component has a `component.story.tsx` for visual development and documentation:

```typescript
import { Meta, StoryObj } from "@storybook/react-vite"
import { Timer } from "."

const meta: Meta<typeof Timer> = {
  title: "Timer / Overview",
  component: Timer,
}

export default meta

export const Overview: StoryObj<typeof Timer> = {
  render: () => <Timer />,
}
```

Run Storybook with:

```bash
pnpm storybook
```

Stories serve double duty: they're development sandboxes (see your component in isolation) and living documentation (other developers see what it looks like and how it behaves).

::: tip Quick orientation
- Business logic lives in `data/`, not `ui/`
- Narrow selectors keep components fast
- Every component has a test, a story, and a `.ftl` file alongside it
:::

## Related documentation

- [Code conventions](./code-conventions.md) — naming, imports, TypeScript patterns
- [Localization](../architecture/l10n.md) — FTL pipeline, identity participation, two-channel delivery
- [State management](../patterns/state-management.md) — commit vs set, selector patterns
- [Testing](./testing.md) — test file structure and trust-in-layers model
- [Tooling](./tooling.md) — scaffolding new features with `pnpm gen`
