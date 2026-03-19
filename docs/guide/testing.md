# Testing

Tests use Vitest with `@testing-library/react`. Each component has a `component.test.tsx` alongside it.

## Component tests

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

- **Import the component as `Component`** — keeps the test generic and easy to move
- **Test via `data-testid`** — not class names or implementation details
- **One test file per component** — colocated, not in a separate `__tests__/` directory

## State system tests

The state system has its own comprehensive test suite in `data/state/_system/system.test.ts`, using mock BroadcastChannel, mock localStorage, and tab simulators from `common/testing/`.

## Running tests

```bash
pnpm test          # all packages
pnpm test:watch    # watch mode
```

Before pushing:

```bash
pnpm test && pnpm lint && pnpm check-types
```

## Related documentation

- [Building components](./building-components.md) — component structure and patterns
- [Code conventions](./code-conventions.md) — naming and import conventions
- [Tooling](./tooling.md) — scaffolding features with tests included
