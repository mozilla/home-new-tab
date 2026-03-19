# Quick Start

This guide will help you get the project running locally.

The goal is to get you from zero to a working environment as quickly as possible.

## Prerequisites

Make sure you have the following installed:

- Node.js (see `.nvmrc` for version)
- pnpm (via corepack)

To enable pnpm:

```bash
npm install --global corepack@latest
corepack enable pnpm
```

## Install dependencies

From the root of the repository:

```bash
pnpm install
```

## Environment setup

There are two `.env` files to configure.

### Root `.env`

Copy the example file:

```bash
cp .env.example .env
```

This file defines ports used by local services.

### API `.env`

Navigate to `clients/api` and copy:

```bash
cp .env.example .env
```

Update the required endpoint values as needed.

If you’re unsure what to use, check with a teammate or use a local/mock endpoint.

## Sync assets

From the root:

```bash
pnpm sync-assets
```

This ensures local assets align with expected production assets.

## Start development

From the root:

```bash
pnpm dev
```

This will:

- start available client services
- assign them to the configured ports
- enable hot reloading for most changes

You can navigate between services in the terminal UI and open them in a browser.

## Optional: run Storybook

To explore UI components in isolation:

```bash
pnpm storybook
```

## What you’re running

When everything is up, you are running a local version of the system:

- API → provides data (proxy or mock)
- Coordinator → manages data and renderer loading
- Renderer → displays the experience

This setup allows you to explore the full system without needing the browser environment.

## Common issues

If something doesn’t work as expected:

- Make sure `.env` files exist and are configured
- Re-run `pnpm install`
- Re-run `pnpm sync-assets`
- Restart the dev server

## Where to go next

- [Mental model (how the system thinks)](../architecture/mental-model.md)
- [Architecture overview (how the pieces fit together)](../architecture/overview.md)
- [Data flow (how information moves through the system)](../architecture/data-flow.md)
