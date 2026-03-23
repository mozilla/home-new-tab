# Repository Structure

This repository is organized to reflect intentional separation of concerns.

The structure is not just about grouping files. It is a way of enforcing how the system is understood and how it evolves over time.

Each workspace exists to answer a simple question:

> Where does this responsibility belong?

If the answer isn't obvious, that's usually a clue worth following.

## High-level structure

At a glance, the repository is divided into a small number of focused areas:

- Clients — runnable applications and system entry points
- Data — business logic and state management
- UI — presentational components and styling
- Common — shared utilities and types
- Config — tooling and development infrastructure

These boundaries help reduce coupling and prevent the kind of entropy that makes systems hard to reason about over time.

## Clients (entry points and systems)

The `clients` workspace contains runnable applications and services.

These represent the primary surfaces where the system is exercised:

- API — local data proxy and contract modeling
- Coordinator — reference implementation of coordination behavior
- Renderer — the bundled user experience
- Web — a temporary integration surface for development

Clients are where everything comes together.

They should remain thin in terms of business logic and rely on other workspaces for shared concerns.

## Data (business logic and state)

The `data` workspace exists to centralize business logic.

It includes:

- state management
- data transformation
- domain-specific behavior

This separation is intentional.

Keeping data logic out of UI and clients helps:

- reduce duplication
- simplify reasoning about behavior
- prevent logic from spreading across the codebase

If logic starts appearing in multiple places, it likely belongs here.

## UI (components and styling)

The `ui` workspace contains presentational components and styling.

It is responsible for:

- rendering UI
- defining visual structure
- maintaining design consistency

UI works best when it stays focused on presentation, not business logic.

This keeps components:

- reusable
- testable in isolation
- easy to reason about

## Common (shared utilities and types)

The `common` workspace contains shared, framework-agnostic code.

It includes:

- utility functions
- shared types

This layer exists to prevent:

- circular dependencies
- duplication of low-level helpers

Code here tends to be:

- small
- well-defined
- broadly reusable

If something needs application context, it probably belongs closer to where that context lives.

## Config (tooling and infrastructure)

The `config` workspace centralizes development tooling.

It includes:

- linting configurations
- TypeScript configurations
- generators
- storybook setup
- asset synchronization

This helps:

- keep tooling consistent across the repo
- avoid repeated configuration
- make development setup easier to maintain

Config is not part of the runtime system, but it plays a critical role in developer experience and consistency.

## Why this structure matters

As systems grow, structure either:

- clarifies intent, or
- hides it

This structure helps make sure that:

- responsibilities are explicit
- boundaries are visible
- changes are easier to reason about

If something feels out of place, it is worth asking why.

That question is often more valuable than the answer.
