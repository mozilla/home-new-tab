# Home — New Tab

Continuous deployment for new tab surfaces. This repo separates the new tab experience into three distinct roles — **API**, **Coordinator**, and **Renderer** — so each can evolve on its own terms without being locked to Firefox's release cadence.

- **API** — Models upstream data for local development. Not a production service.
- **Coordinator** — Privacy-preserving data pipeline and cache manager. Uses SWR to update renderers without disrupting the user. In production, this lives in browser core.
- **Renderer** — The user experience, built and deployed to remote settings for continuous delivery. The primary production artifact shipped from this repo.

## Documentation

**[Full documentation →](https://mozilla.github.io/home-new-tab/)** (auto-deployed from `docs/`)

The docs cover architecture, contracts, subsystem deep-dives, and development guides. Start with [What is this?](docs/guide/what-is-this.md) for orientation.

## Quick Start

```bash
corepack enable pnpm
pnpm install
```

Set up environment files:

- Copy `.env.example` → `.env` at root (ports for Vite)
- Copy `clients/api/.env.example` → `clients/api/.env` (data endpoint)

```bash
pnpm sync-assets    # align local assets with production
pnpm dev            # start all services with hot reload
pnpm storybook      # component development sandbox
```

## Repository Structure

```
clients/     — runnable apps (api, coordinator, renderer, web)
common/      — @common/types, @common/utilities
config/      — build config, linting, generators
data/        — @data/state (Zustand stores), @data/mocks
ui/          — @ui/components, @ui/styles
docs/        — architecture, contracts, and guides
```

For the full workspace breakdown, see [Repo structure](docs/guide/repo-structure.md).

## Tech Stack

React 19, TypeScript, Zustand, Vite, TurboRepo, PostCSS + CSS Modules, Vitest, Storybook. Package manager: `pnpm` only.
