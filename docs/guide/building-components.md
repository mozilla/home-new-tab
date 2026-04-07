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

Native CSS nesting keeps related styles together under your class name instead of scattering them across the file. Use `&` for pseudo-states and pseudo-elements, and nest child classes directly:

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

Nesting reflects the DOM structure. This keeps the relationship explicit and avoids flat lists of disconnected selectors.

Not everything needs to live under `.base`. Define additional top-level classes when a part of the component has its own layout concerns or doesn't share a container relationship with `.base`. `.base` gets you started with a reasonable root container, not a cage.

### Key patterns

- **Container queries** for responsive behavior, components respond to their own size, not the viewport
- **CSS variables** for design tokens, `var(--space-medium)`, not `16px`
- **`.base`** as the root class name, consistent entry point for every component's styles

Global styles and design tokens live in `ui/styles/`.

## Localization

Each component that renders user-visible text gets a `component.ftl` file in the same directory. This is the en-US baseline, the only locale authored in this repo. Components reference message IDs via `data-l10n-id` attributes — the ESLint plugin (`no-missing-message`) validates every reference against the colocated FTL at edit time.

### Static strings

The simplest case: a message with no variables.

```ftl
renderer-info-title = Intentionally Boring Renderer
```

```tsx
<h1 data-l10n-id="renderer-info-title" />
```

### Variable interpolation

When a message includes dynamic content, document each variable with a `# Variables:` block above the message. Pass values at runtime via `data-l10n-args` as a JSON object.

```ftl
# Variables:
#   $hash (String) - Content hash of the current renderer entry artifact
renderer-info-hash = Hash: { $hash }
```

```tsx
<li
  data-l10n-id="renderer-info-hash"
  data-l10n-args={JSON.stringify({ hash })}
/>
```

### Selectors

Use selectors when a message has variants driven by state. This keeps all display strings in FTL and out of component logic. Boolean props are passed as strings since Fluent variant keys are string-matched — `String(prop)` is the convention.

```ftl
# Variables:
#   $updating (String) - "true" when a renderer update is pending, "false" otherwise
renderer-info-renderer-section =
    { $updating ->
        [true] Renderer — will update
       *[false] Renderer — cached
    }
```

```tsx
<header
  data-l10n-id="renderer-info-renderer-section"
  data-l10n-args={JSON.stringify({ updating: String(renderUpdate) })}
/>
```

The `*` prefix marks the default variant — use it on the most common or least surprising state.

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

### Sidebar structure

Story titles use a flat two-level format: `"Group / Name"`. No deeper nesting.
The named export matches the sidebar leaf.

```typescript
// correct — two levels, export matches leaf
const meta = { title: "Dev Panel / Sources" }
export const Sources: StoryObj<...> = { ... }

// avoid — three levels create nested folders in the sidebar
const meta = { title: "Dev / Panel / Sources" }
```

### State variants via controls

Prefer one story with controls over multiple named exports for different states.
Add custom boolean args via a `ComponentPropsAndCustomArgs` type and derive props
in `render`:

```typescript
type ComponentPropsAndCustomArgs = {
  withData: boolean
} & React.ComponentProps<typeof MyComponent>

const meta: Meta<ComponentPropsAndCustomArgs> = {
  title: "Section / MyComponent",
  component: MyComponent,
}
export default meta

export const MyComponent: StoryObj<ComponentPropsAndCustomArgs> = {
  render: (args) => {
    const withData = args.withData ? { data: mockData } : {}
    return <MyComponent {...args} {...withData} />
  },
  args: { withData: false },
  argTypes: {
    data: { table: { disable: true } },
  },
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
