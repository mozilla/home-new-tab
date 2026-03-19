# Contributing

Welcome. This guide covers how to get set up, how we work in the codebase, and what makes contributions go smoothly.

The short version: take a moment to plan, let the tooling help you, and when something feels unclear, ask rather than guess.

## Prerequisites

- **Node.js** — check `.nvmrc` for the expected version
- **pnpm** — installed via corepack (`corepack enable`)
- **Environment files** — `.env` at the root and in `clients/api/` (see [Quick start](../guide/quick-start.md))

## Getting started

```bash
pnpm install          # install all workspace dependencies
pnpm sync-assets      # align local assets with production
pnpm dev              # start all services with hot reload
```

`pnpm dev` opens a terminal UI where you can select which services to run. For component development in isolation:

```bash
pnpm storybook        # visual component sandbox
```

For the full setup walkthrough: [Quick start](../guide/quick-start.md).

## Useful commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start all clients with hot reload |
| `pnpm build` | Build all packages (via TurboRepo) |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm lint` | Lint all packages |
| `pnpm storybook` | Component development sandbox |
| `pnpm gen` | Scaffold a new feature (plop generator) |
| `pnpm format` | Format code (Prettier) |
| `pnpm check-types` | TypeScript type checking |

## Scaffolding new features

Use the generator:

```bash
pnpm gen
```

This creates a complete feature in one step — state store, component, test, story, and CSS module. It enforces naming conventions and file structure automatically.

Templates live in `config/generator-config/`. It's the easiest way to get the file structure right without thinking about it.

## How we work

A few principles that have served the project well:

**Plan before code.** Taking a moment to propose an approach and align on it — even for small changes — saves rework and keeps things predictable.

**Surface gaps, name them.** If the docs are silent on something, that's worth saying out loud. Inventing behavior to fill the silence is how implicit assumptions become load-bearing.

**Call out drift.** If the code and the contracts in `docs/spec/` disagree, naming it explicitly is more valuable than working around it.

**Stay in scope.** One task at a time. The temptation to refactor, clean up, or "improve" nearby code is real — but staying focused keeps things moving.

**Collaborate, think out loud.** Challenging assumptions and asking questions is how the best work happens. The keyboard comes last.

## Understanding the documentation

The docs are organized by audience and purpose:

| Section | What it covers | Tone |
|---------|---------------|------|
| `guide/` | First contact — what is this, how to get started, how we work | Warm, approachable |
| `architecture/` | How the pieces fit — mental model, overview, data flow, subsystems | Clear, structural |
| `spec/` | Contracts and reference — system invariants, glossary, API surfaces | Formal, precise |
| `meta/` | Process — tasks, contributing, agent context | Welcoming, actionable |

**Contracts are the intended direction.** When code and contracts disagree, the contract represents where we're headed and the code represents where we are. Naming that gap is more valuable than assuming either side is definitively right.

## Running tests

```bash
pnpm test             # all packages
pnpm test:watch       # watch mode (re-runs on change)
```

Every component should have a `component.test.tsx` using Vitest and `@testing-library/react`. State system tests live in `data/state/_system/system.test.ts`.

Before pushing, make sure tests pass:

```bash
pnpm test && pnpm lint && pnpm check-types
```

## Code conventions

The project has documented conventions for TypeScript, CSS, naming, imports, and formatting. These are mostly enforced by tooling (ESLint, Prettier, Stylelint), but some are enforced by habit.

The full reference: [Code conventions](../guide/code-conventions.md).

The key points:

- Named exports, no barrel files
- `import type` for type-only imports
- CSS Modules per component
- Workspace aliases for cross-package imports
- Selectors for state access (keeps re-renders tight)

## Related documentation

- [Quick start](../guide/quick-start.md) — full setup walkthrough
- [Code conventions](../guide/code-conventions.md) — coding standards
- [Building components](../guide/building-components.md) — component development workflow
- [File map](../spec/file-map.md) — where things live
- [Mental model](../architecture/mental-model.md) — how the system thinks
- [Glossary](../spec/glossary.md) — project terminology
