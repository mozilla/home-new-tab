# Testing

Tests use Vitest with `@testing-library/react`. Each testable unit has a colocated test file alongside it.

## Trust in layers

The monorepo is structured so each layer proves its own correctness. Consumers of that layer trust it and don't re-prove it.

| Layer                  | What tests prove                                    | Who trusts it                     |
| ---------------------- | --------------------------------------------------- | --------------------------------- |
| `common/utilities/`    | Pure functions return correct results               | State stores, components, tooling |
| `data/state/_system/`  | Sync, persistence, and merge work correctly         | Domain stores                     |
| `data/state/{domain}/` | Domain actions and derived state behave correctly   | Components                        |
| `ui/components/`       | Components render the right structure given state   | Client integrations               |
| `config/` plugins      | ESLint rules and build tools produce correct output | Build pipeline                    |

This means: a component test doesn't re-check that `formatMMSS` returns the right string, that's a utility test. A domain store test doesn't re-prove LWW merge, that's a system test. Each layer does its job so the next layer can focus on its own.

When you're writing a test and find yourself setting up behavior that belongs to a lower layer, that's a signal. Either the lower layer needs a test, or you're testing at the wrong altitude.

## Utility tests

Pure function tests in `common/utilities/`. These are the simplest: input in, output out, no mocks.

```typescript
import { describe, it, expect } from "vitest"

import { formatMMSS } from "./time"

describe("formatMMSS", () => {
  it("formats zero", () => {
    expect(formatMMSS(0)).toBe("00:00")
  })

  it("formats minutes and seconds", () => {
    expect(formatMMSS(125000)).toBe("02:05")
  })
})
```

Utility tests earn trust for everything above them. Get these right and the rest of the stack can use `formatMMSS` without a second thought.

## State system tests

The cross-tab sync infrastructure has a comprehensive test suite in `data/state/_system/system.test.ts`. It uses mock BroadcastChannel, mock localStorage, and tab simulators from `common/testing/`.

These tests cover sync, persistence, restore modes, and LWW merge. These are the mechanics that every domain store inherits, so domain stores don't need to re-test them.

## Domain store tests

Domain stores (`data/state/{domain}/`) test their own actions and derived state. They trust that `createSyncedStore` works and focus on domain logic.

```typescript
// data/state/timer/timer.test.ts
describe("timer store", () => {
  it("starts the timer", () => {
    const store = createTestStore()
    store.getState().actions.start()
    expect(store.getState().data.status).toBe("running")
  })
})
```

Helper functions that live alongside the store (e.g., `data/state/timer/helpers/`) get their own test files for the same reason utilities do. Prove it once, trust it everywhere.

## Component tests

Each component has a `component.test.tsx` alongside it. Component tests confirm the component renders the right structure, not that the underlying data is correct.

```typescript
import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { Timer as Component } from "."

describe("renders Timer", () => {
  it("with defaults", () => {
    const rendered = render(<Component />)
    expect(rendered.getByTestId("timer")).toBeInTheDocument()
  })
})
```

Patterns:

- **Import the component as `Component`**, keeps the test generic and easy to move
- **Test via `data-testid`**, not class names or implementation details
- **One test file per component**, colocated, not in a separate `__tests__/` directory

Component tests are the top of the trust stack. They can assume utilities return correct values and stores manage state correctly, because those layers have their own tests.

## Build tooling tests

ESLint plugins and build utilities in `config/` have their own test files. These prove that rules flag what they should and tools produce correct output. The build pipeline trusts these without further checks.

```
config/eslint-config/plugins/fluent-l10n/rules/no-missing-message.test.ts
config/eslint-config/plugins/state-hygiene/rules/no-mutation-in-setter.test.ts
config/l10n-config/src/utilities/fluent-utils.test.ts
```

## Where the effort goes

The trust model shapes where testing effort is most valuable:

- **Utility and system tests deserve thoroughness.** They're the foundation. Edge cases, boundary conditions, error paths: invest here. Everything above benefits.
- **Domain store tests focus on actions and transitions.** The interesting logic is what happens when the timer starts, pauses, resets. Not the plumbing.
- **Component tests stay light.** Does it render? Does it show the right pieces? That's usually enough. The data driving it is already tested below.
- **Don't test the framework.** React renders components. Zustand calls subscribers. Vitest runs assertions. Trust them.
- **Don't test CSS values.** Visual correctness lives in Storybook, not assertions about class names or computed styles.
- **Don't re-test across layers.** If `formatMMSS` is tested in `common/utilities/time/`, a component test asserting "02:05" appears in the DOM is testing `formatMMSS` with extra steps. Test that the element exists, the value is already trusted.

## Running tests

```bash
pnpm test          # all packages
pnpm test:watch    # watch mode
```

Pre-commit hooks run lints, type checks, and tests automatically before each commit. You don't need to remember to run these manually. If you want to run them ahead of time:

```bash
pnpm test && pnpm lint && pnpm check-types
```

## Related documentation

- [Building components](./building-components.md) — component structure and patterns
- [Code conventions](./code-conventions.md) — naming and import conventions
- [State management](../patterns/state-management.md) — store patterns and mutation paths
- [Tooling](./tooling.md) — scaffolding features with tests included
