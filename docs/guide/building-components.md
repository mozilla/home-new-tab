# Building Components

Components are presentational. They render UI. They don't fetch data, manage business logic, or decide what to show. That responsibility lives in state stores (`data/state/`) and the coordinator.

## Component structure

Each component lives in a kebab-case folder under `ui/components/`:

```
timer/
├── index.tsx              # Component (named export)
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

- **Named exports** — `export function Timer()`, not `export default`
- **`data-testid`** — every component has one, used by tests
- **CSS module import first** — style import is always the first line
- **No business logic** — if you're reaching for `fetch` or complex conditional logic, it probably belongs in `data/state/`

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

- **Selectors keep re-renders tight.** `useTimer((s) => s.data.status)` re-renders only when `status` changes. `useTimer()` re-renders on every store update — that's the difference.
- **Narrow selectors for data and actions.** Pick what you need, leave the rest.
- **Package aliases for imports.** `@data/state/timer` reads better and won't break when things move around — unlike `../../../data/state/timer`.

For more on how stores work: [State management](./state-management.md).

## CSS Modules

Every component gets a `style.module.css`. Styles are scoped automatically.

```css
.base {
  display: grid;
  container-type: inline-size;
  gap: var(--space-medium);
}
```

Key patterns:

- **Container queries** for responsive behavior — components respond to their own size, not the viewport
- **CSS variables** for design tokens — `var(--space-medium)`, not `16px`
- **`.base`** as the root class name — consistent entry point for every component's styles

Global styles and design tokens live in `ui/styles/`.

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
- Every component has a test and a story alongside it
:::

## Related documentation

- [Code conventions](./code-conventions.md) — naming, imports, TypeScript patterns
- [State management](./state-management.md) — commit vs set, selector patterns
- [Testing](./testing.md) — test file structure and patterns
- [Tooling](./tooling.md) — scaffolding new features with `pnpm gen`
