# Tooling

Tools and automation available in this codebase.

## Feature scaffolding

New features are scaffolded with plop:

```bash
pnpm gen
```

This runs an interactive generator that creates a complete feature in one step:

- State store in `data/state/{feature}/`
- Component in `ui/components/{feature}/`
- Test, story, and CSS module alongside the component
- Optional: a colocated UI hook for derived display values

Templates live in `config/generator-config/`. The generator respects existing files (`skipIfExists: true`) and shows a plan before writing anything.

The generator takes care of file structure, naming conventions, and boilerplate — so you don't have to remember all of it yourself. It's one of those things that feels optional the first time and indispensable the second.

## Workspace aliases

Use these instead of relative paths when importing across packages:

| Alias | Resolves to |
|-------|-------------|
| `@ui/components` | `ui/components` |
| `@ui/styles` | `ui/styles` |
| `@common/types` | `common/types` |
| `@common/utilities` | `common/utilities` |
| `@data/state` | `data/state` |
| `@data/mocks` | `data/mocks` |

```typescript
// Good — workspace alias
import { useTimer } from "@data/state/timer"
import type { AppProps } from "@common/types"

// Avoid — relative cross-package path
import { useTimer } from "../../../data/state/timer"
```

Relative imports are fine within a package. Across packages, the alias is the way to go.

## Common commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start all clients with hot reload |
| `pnpm build` | Build all packages (via TurboRepo) |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm test:watch` | Watch mode |
| `pnpm lint` | Lint all packages |
| `pnpm storybook` | Component development sandbox |
| `pnpm gen` | Scaffold a new feature |
| `pnpm format` | Format code (Prettier) |
| `pnpm check-types` | TypeScript type checking |

## Related documentation

- [Building components](./building-components.md) — component structure and workflow
- [Code conventions](./code-conventions.md) — naming and import conventions
- [Quick start](./quick-start.md) — initial setup
