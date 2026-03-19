# Data Flow

This document describes how data moves through the system at a high level.

The goal is not to capture every implementation detail. It is to show how information moves from upstream sources to a rendered new tab experience, and where responsibility changes hands along the way.

## Why this matters

When systems become hard to reason about, it is often because the flow of data is unclear.

This project tries to avoid that.

Instead of allowing data fetching, transformation, coordination, rendering, and delivery to blur together, it separates them into distinct stages with explicit responsibilities.

That separation makes it easier to answer questions like:

- Where does this data come from?
- Who is allowed to transform it?
- Who decides when it is fresh or stale?
- What reaches the renderer?
- What must already be true before rendering begins?

## The high-level path

At a glance, the flow looks like this:

1. Data originates from upstream sources
2. The coordinator retrieves and prepares the data needed for the experience
3. The coordinator loads an appropriate renderer
4. The renderer consumes the coordinated data
5. The user sees the resulting experience

A separate delivery pipeline ensures that the renderer made available to the coordinator is valid before runtime ever attempts to use it.

## 1. Upstream data sources

The experience begins with data that exists outside the renderer.

In local development, this may be represented through a proxy or modeled API layer within this repository.

In production, data may come from multiple upstream services.

What matters is not the exact source layout, but that the coordinator receives data in shapes it knows how to work with.

At this stage, the main concern is availability of source data—not presentation.

## 2. Coordination and retrieval

The coordinator is the integration point between data and experience.

The coordinator is a passthrough and privacy boundary — it retrieves, caches, and sanitizes data but does not transform it. For its full responsibility model, see [Coordinator](./coordinator.md).

This is where runtime control lives. The coordinator prepares the conditions under which the UI can be rendered safely and predictably.

## 3. Renderer delivery and selection

The renderer is not assembled at runtime.

It is built ahead of time, validated through the delivery pipeline, and made available as a known artifact for the coordinator to load.

At runtime, the coordinator is responsible for determining which renderer it should use and when to update to a newer one.

That means the coordinator sits at an important boundary:

- upstream data arrives from one side
- validated renderer artifacts arrive from another
- the coordinator brings them together into a usable experience

This is one of the most important separations in the system.

It allows the user experience to evolve independently while keeping the runtime integration layer stable.

## 4. Data handoff to the renderer

Once the coordinator has both:

- the data it intends to provide
- the renderer it intends to load

it can hand control to the renderer.

At that point, the renderer consumes coordinated data and renders the user experience.

The renderer should not need to:

- fetch unrelated upstream data on its own
- infer missing runtime guarantees
- repair invalid delivery artifacts

Those concerns belong earlier in the flow.

This keeps the renderer focused on the user experience rather than system orchestration.

## 5. Rendering the experience

After handoff, the renderer produces the visible new tab experience.

This is the point where all prior stages become meaningful to the user:

- data is available
- renderer assets are valid
- runtime conditions have been coordinated
- the UI can be displayed

If everything upstream has done its job well, this stage should feel simple.

That simplicity is intentional.

## Delivery pipeline in relation to runtime flow

The delivery pipeline sits adjacent to runtime data flow, not inside it.

Its job is to ensure that renderer artifacts are:

- assembled correctly
- validated before release
- made available in a form the coordinator can safely consume

This means runtime should not be responsible for deciding whether a renderer is valid.

By the time the coordinator sees a renderer, that question should already be answered.

For more detail:

- [Build system (how renderer artifacts are assembled)](./build-system.md)
- [Publish pipeline (how renderer artifacts become available to runtime)](./publish-pipeline.md)

## Local development and production reality

This repository allows the full flow to be explored in one place, but production ownership is more distributed. The flow remains the same even when ownership changes — that is part of the value of defining the architecture clearly. For the full local-vs-production ownership map, see [Architecture overview](./overview.md#local-vs-production-ownership).

## What this flow tries to protect

This flow is designed to protect a few important qualities:

- clear separation of responsibilities
- safe rapid iteration on the renderer
- predictable runtime behavior
- reduced hidden coupling between systems

If data flow becomes confusing, those qualities tend to erode quickly.

That is why the system treats flow as something to define explicitly rather than assume implicitly.

## Related documentation

- [Mental model (how the system thinks)](./mental-model.md)
- [Architecture overview (how the pieces fit together)](./overview.md)
- [Coordinator (integration, caching, and update behavior)](./coordinator.md)
- [Renderer (how the user experience is built and delivered)](./renderer.md)
- Contracts:
  - [Snapshot contract](../spec/snapshot-contract.md)
  - [Artifact model](../spec/artifact-model.md)
  - [Identity model](../spec/identity-model.md)
  - [Validation rules](../spec/validation-rules.md)
  - [Lifecycle contract](../spec/lifecycle-contract.md)
