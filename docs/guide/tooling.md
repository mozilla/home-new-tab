# Tooling

Tools and automation available in this codebase.

## Feature scaffolding

The repo includes code generators that create consistent file structures from templates. Instead of manually creating a component folder, test file, story, CSS module, and store by hand (and hoping you remembered everything), you run a single command and get the full structure in one step.

```bash
pnpm gen
```

This runs an interactive prompt that asks for a feature name and options, then creates:

- State store in `data/state/{feature}/`
- Component in `ui/components/{feature}/`
- Test, story, CSS module, and FTL file alongside the component
- Optional: a colocated UI hook for derived display values

Templates live in `config/generator-config/`. The generator respects existing files (`skipIfExists: true`) and shows a plan before writing anything.

Generators enforce the same conventions the docs describe. If the file structure or naming pattern changes, the templates update in one place and every new feature gets it right automatically.

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
