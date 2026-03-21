# File Map

An annotated guide to where things live in this monorepo.

Use this when you need to find something or figure out where new code should go. The structure is intentional — if something feels like it belongs somewhere, it probably does.

## Top Level

```
home-tab/
├── clients/          — runnable applications
├── common/           — shared types, utilities, l10n, testing
├── config/           — build config, linting, generators
├── data/             — state stores and mock data
├── ui/               — components and styles
├── docs/             — source of truth for architecture and contracts
├── package.json      — root workspace config
├── pnpm-workspace.yaml
├── turbo.json        — TurboRepo task orchestration
└── vitest.config.ts  — root test config
```

## clients/

Runnable applications. Each has its own entry point and serves a specific role.

```
clients/
├── api/              — local data proxy (Hono), simulates upstream sources
├── coordinator/      — reference coordinator: boot, SWR, renderer + data caching
├── renderer/         — production artifact: React entry, the thing that ships
└── web/              — development integration surface
```

**api/** — Not a production service. Models the shape of upstream data for local development. Proxies external discover and weather endpoints. See [Architecture overview](../architecture/overview.md).

**coordinator/** — Reference implementation of coordinator behavior. In production this lives in browser core. Key modules: `main.ts` (boot flow), `renderer-cache.ts` (Cache API management), `data-cache.ts` (SWR data refresh). See [Coordinator deep-dive](../architecture/coordinator.md).

**renderer/** — The primary production artifact. React 19 application, bundled as a snapshot, consumed by the coordinator. See [Renderer deep-dive](../architecture/renderer.md).

**web/** — Temporary integration surface for development. Ties the coordinator and renderer together locally.

## data/

State management and mock data.

```
data/
├── state/            — Zustand stores by domain
│   ├── _system/      — cross-tab sync infrastructure
│   ├── timer/        — synced store (session restore, cross-tab)
│   ├── discover/     — plain Zustand (fetch-driven, devtools)
│   └── sponsored/    — plain Zustand (devtools)
└── mocks/            — mock data fixtures for development and testing
```

**state/_system/** — The engine behind synced stores. Contains `createSyncedStore` factory, BroadcastChannel transport, LWW merge, localStorage restore, session discovery, and runtime guards. See [State management](../guide/state-management.md).

**state/timer/** — Example of a synced store: session restore, cross-tab sync, `commit()`/`set()` action pattern.

**state/discover/**, **state/sponsored/** — Plain Zustand stores with devtools. No sync, no restore. Fetch-driven, local to each tab.

## common/

Shared packages used across the monorepo.

```
common/
├── types/            — shared type definitions (@common/types)
├── utilities/        — framework-agnostic helpers (@common/utilities)
│   ├── arrays/       — array transformation (arrayToObject)
│   ├── coords/       — polar-to-cartesian math
│   ├── logger/       — buffered, leveled console logger
│   ├── time/         — timer math, formatting, calendar dates
│   ├── values/       — safeJsonParse, path checks
│   └── versions/     — semver comparison, range checks
├── l10n/             — localization infrastructure
└── testing/          — test utilities (mock-crypto, mock-storage, tab-simulator)
```

**types/** — All shared type definitions: `AppRenderManifest`, `AppProps`, `RendererModule`, `CoordinatedData`, feed types, sponsored types. See [API surfaces](./api-surfaces.md).

**utilities/** — Small, focused helpers. No framework dependencies. Each subdirectory is a single concern.

**testing/** — Test infrastructure: mock BroadcastChannel, mock localStorage, mock crypto, tab simulators, sync frame helpers. Used by the state system tests.

## ui/

Components and styles.

```
ui/
├── components/       — presentational React components (@ui/components)
│   ├── _base/        — shared decorators
│   └── [feature]/    — index.tsx, component.test.tsx, component.story.tsx, style.module.css
└── styles/           — global styles, CSS variables, design tokens (@ui/styles)
```

**components/** — Presentational only. No business logic. Each component lives in a kebab-case folder with a standard file set. See [Building components](../guide/building-components.md).

**styles/** — Design tokens as CSS variables, global resets, shared style utilities.

## config/

Build and development configuration packages.

```
config/
├── eslint-config/        — shared ESLint rules (base + component)
├── generator-config/     — plop templates for scaffolding features
├── typescript-config/    — shared tsconfig bases
├── storybook-config/     — Storybook setup
├── stylelint-config/     — CSS linting rules
├── l10n-config/          — localization tooling
├── asset-config/         — asset synchronization
└── editor-integrations/  — IDE-specific config
```

**generator-config/** — Plop templates that scaffold a complete feature: state store + component + test + story + CSS module in one command. Run via `pnpm gen`. See [Tooling](../guide/tooling.md).

## docs/

Documentation, organized by audience and purpose.

```
docs/
├── guide/            — first contact: welcome, repo structure, quick start, conventions, patterns
├── architecture/     — how pieces fit: overview, mental model, data flow, gating, coordinator, renderer, build, publish, l10n
├── spec/             — system invariants and contracts (authoritative source of truth), plus reference tables
├── meta/             — process: tasks, contributing, agent context, charts
└── lessons/          — video series scripts (tone reference, not system docs)
```

Contracts in `spec/` are the authoritative source of truth. Everything else derives from or supports them.

## Related documentation

- [Repo structure](../guide/repo-structure.md)
- [Architecture overview](../architecture/overview.md)
- [Quick start](../guide/quick-start.md)
- [Building components](../guide/building-components.md)
- [Glossary](./glossary.md)
