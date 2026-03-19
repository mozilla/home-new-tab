# Welcome

This repository is a space to explore, build, and refine the browser new tab experience outside of the browser itself.

It exists to answer a simple question:

> How can we move faster without sacrificing stability, privacy, or clarity?

## The problem

The new tab is a high-impact surface.

But traditionally, it is:

- tightly coupled to the browser codebase
- tied to slower release cycles
- difficult to iterate on quickly

That makes it hard to experiment, learn, and improve the experience at the pace we would like.

## The approach

This project explores a different model.

Instead of treating the new tab as a single system, we separate it into distinct roles:

- data (what the experience is built from)
- coordination (how data and updates are managed)
- rendering (what the user actually sees)

These roles are defined clearly and connected through explicit contracts.

This allows each part to evolve without creating hidden coupling or unintended side effects.

## What this repository provides

This repo is not just an application.

It is a combination of:

- a working development environment
- a reference architecture
- a place to define and refine system contracts
- a space to experiment safely

Some parts are modeled here (such as data access). Others are implemented as reference systems (such as coordination). The renderer is built and shipped from here — that's the production artifact this repo owns.

In production, ownership may differ — but the contracts remain consistent.

## What this repository is not

This repository does not directly own every production runtime in the final system.

Some parts of the architecture exist here as conceptual models, reference implementations, or local development infrastructure. Browser-integrated behavior — especially coordination — may ultimately be implemented and owned elsewhere, as long as it fulfills the contracts defined here.

This allows the repo to stay focused on architecture, contracts, tooling, and renderer delivery without assuming all local implementations are production authorities.

## How the codebase is organized

The repo is structured to reflect these boundaries:

- **Clients** — runnable applications and services (API, coordinator, renderer)
- **Data** — business logic and state management
- **UI** — presentational components and styling
- **Common** — shared utilities and types
- **Config** — tooling, linting, generators, and build configuration

Each workspace exists to reduce hidden coupling and make responsibilities explicit. If something feels out of place, that's usually a signal — not an inconvenience.

More detail in [Repo structure](./repo-structure.md).

## Where to go next

- [Mental model](../architecture/mental-model.md) — how the system thinks
- [Architecture overview](../architecture/overview.md) — how the pieces fit together
- [Quick start](./quick-start.md) — run the project locally
